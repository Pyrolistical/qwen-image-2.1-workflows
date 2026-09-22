import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { pngText } from "./png";

export interface WorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}

export type Workflow = Record<string, WorkflowNode>;

export interface NodeRef {
  id: string;
  classType: string;
}

export function nodeOf(workflow: Workflow, node: NodeRef): WorkflowNode {
  const found = workflow[node.id];
  if (!found) {
    throw new Error(`workflow has no node ${node.id}`);
  }
  if (found.class_type !== node.classType) {
    throw new Error(
      `workflow node ${node.id} is ${found.class_type}, expected ${node.classType}`,
    );
  }
  return found;
}

export function inputsOf(
  workflow: Workflow,
  node: NodeRef,
): Record<string, unknown> {
  return nodeOf(workflow, node).inputs;
}

export function promptInPng(png: Uint8Array): Workflow | undefined {
  const prompt = pngText(png, "prompt");
  if (prompt === undefined) {
    return;
  }
  return JSON.parse(prompt) as Workflow;
}

interface ProgressSample {
  value: number;
  time: number;
}

export function nodeRemaining(
  first: ProgressSample,
  current: ProgressSample,
  max: number,
): number | undefined {
  const done = current.value - first.value;
  if (done <= 0) {
    return;
  }
  return ((current.time - first.time) / done) * (max - current.value);
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return minutes > 0 ? `${minutes}m${rest}s` : `${seconds}s`;
}

const ENV_PATH = join(import.meta.dirname, "..", ".env");

async function readEnv(): Promise<Record<string, string | undefined>> {
  return { ...(await readEnvFile()), ...process.env };
}

async function readEnvFile(): Promise<Record<string, string | undefined>> {
  try {
    return parseEnv(await readFile(ENV_PATH, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

const PROBE_TIMEOUT_MS = 1000;
const DEFAULT_COMFY_UI_URL = "http://localhost:8188";

type ServerLoad = number | "down";

export function comfyUrls(value: string): string[] {
  const urls = value
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter((url) => url !== "");
  if (!urls.length) {
    throw new Error("COMFY_UI_URL must be a comma separated list of urls");
  }
  return urls;
}

function describe(loads: [string, ServerLoad][]): string {
  return loads
    .map(([url, load]) =>
      load === "down" ? `${url} down` : `${url} ${load} queued`,
    )
    .join(", ");
}

export function shortestQueue(loads: [string, ServerLoad][]): string {
  let shortest: [string, number] | undefined;
  for (const [url, load] of loads) {
    if (load !== "down" && (shortest === undefined || load < shortest[1])) {
      shortest = [url, load];
    }
  }
  if (shortest === undefined) {
    throw new Error(`no comfyui server up: ${describe(loads)}`);
  }
  return shortest[0];
}

async function loadOf(url: string): Promise<ServerLoad> {
  try {
    const response = await fetch(`${url}/queue`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return "down";
    }
    const queue = (await response.json()) as Queue;
    return queue.queue_running.length + queue.queue_pending.length;
  } catch {
    return "down";
  }
}

export async function queueServer(): Promise<string> {
  const urls = comfyUrls(
    (await readEnv()).COMFY_UI_URL ?? DEFAULT_COMFY_UI_URL,
  );
  const loads = await Promise.all(
    urls.map(async (url): Promise<[string, ServerLoad]> => [
      url,
      await loadOf(url),
    ]),
  );
  const server = shortestQueue(loads);
  console.log(`server ${server}, ${describe(loads)}`);
  return server;
}

const PROMPT_EVENT_TYPES = [
  "execution_start",
  "executing",
  "progress",
  "execution_success",
  "execution_error",
  "execution_interrupted",
] as const;

type PromptEventType = (typeof PROMPT_EVENT_TYPES)[number];

const promptEventTypes: ReadonlySet<string> = new Set(PROMPT_EVENT_TYPES);

interface PromptEvent {
  type: PromptEventType;
  data: {
    prompt_id?: string;
    node?: string;
    node_type?: string;
    value?: number;
    max?: number;
    exception_message?: string;
  };
}

interface HistoryFile {
  filename: string;
  subfolder: string;
  type: string;
}

type QueueItem = [number, string, ...unknown[]];

interface Queue {
  queue_running: QueueItem[];
  queue_pending: QueueItem[];
}

export function aheadIn(queue: Queue, promptId: string): number | undefined {
  const mine = queue.queue_pending.find(([, id]) => id === promptId);
  if (mine === undefined) {
    return;
  }
  return (
    queue.queue_running.length +
    queue.queue_pending.filter(([number]) => number < mine[0]).length
  );
}

export class ComfyClient {
  constructor(private readonly base: string) {}

  async runPrompt(workflow: Workflow): Promise<string> {
    const clientId = crypto.randomUUID();
    const socket = new WebSocket(
      `${this.base.replace(/^http/, "ws")}/ws?clientId=${clientId}`,
    );
    try {
      await waitForOpen(socket);
      const messages = socketMessages(socket);
      const promptId = await this.queuePrompt(workflow, clientId);
      console.log(`queued ${promptId}`);
      await trackPrompt(messages, workflow, promptId, async () =>
        aheadIn(await this.queue(), promptId),
      );
      return promptId;
    } finally {
      socket.close();
    }
  }

  async uploadImage(bytes: Uint8Array, extension: string): Promise<string> {
    const filename = `${createHash("sha256").update(bytes).digest("hex")}${extension}`;
    const form = new FormData();
    form.append("image", new Blob([bytes]), filename);
    form.append("type", "input");
    const response = await fetch(`${this.base}/upload/image`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(
        `POST /upload/image ${response.status}: ${await response.text()}`,
      );
    }
    const { name, subfolder } = (await response.json()) as {
      name: string;
      subfolder: string;
    };
    if (name !== filename) {
      throw new Error(`uploaded ${filename} but server saved ${name}`);
    }
    console.log(`uploaded ${name}`);
    return subfolder ? `${subfolder}/${name}` : name;
  }

  async outputOf(promptId: string, node: string): Promise<HistoryFile> {
    const response = await fetch(`${this.base}/history/${promptId}`);
    if (!response.ok) {
      throw new Error(`GET /history ${response.status}`);
    }
    const history = (await response.json()) as Record<
      string,
      { outputs?: Record<string, { images?: HistoryFile[] }> }
    >;
    const files = history[promptId]?.outputs?.[node]?.images ?? [];
    const [file] = files;
    if (file === undefined || files.length > 1) {
      throw new Error(
        `expected 1 output from node ${node} for ${promptId}, got ${files.length}`,
      );
    }
    return file;
  }

  async downloadImage(file: HistoryFile): Promise<Uint8Array> {
    const response = await fetch(
      `${this.base}/view?${new URLSearchParams({ ...file })}`,
    );
    if (!response.ok) {
      throw new Error(`GET /view ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`GET /view returned ${contentType || "no content type"}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private async queue(): Promise<Queue> {
    const response = await fetch(`${this.base}/queue`);
    if (!response.ok) {
      throw new Error(`GET /queue ${response.status}`);
    }
    return (await response.json()) as Queue;
  }

  private async queuePrompt(
    workflow: Workflow,
    clientId: string,
  ): Promise<string> {
    const response = await fetch(`${this.base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!response.ok) {
      throw new Error(
        `POST /prompt ${response.status}: ${await response.text()}`,
      );
    }
    const { prompt_id } = (await response.json()) as { prompt_id: string };
    return prompt_id;
  }
}

async function waitForOpen(socket: WebSocket): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  socket.onopen = () => resolve(undefined);
  socket.onerror = () => reject(new Error(`cannot connect to ${socket.url}`));
  await promise;
}

function socketMessages(socket: WebSocket): ReadableStream<string> {
  const listeners = new AbortController();
  return new ReadableStream({
    start(controller) {
      socket.addEventListener(
        "message",
        (event) => {
          if (typeof event.data === "string") {
            controller.enqueue(event.data);
          }
        },
        { signal: listeners.signal },
      );
      socket.addEventListener(
        "close",
        () => {
          listeners.abort();
          controller.error(new Error("websocket closed"));
        },
        { signal: listeners.signal },
      );
    },
    cancel() {
      listeners.abort();
      socket.close();
    },
  });
}

async function* promptEvents(
  messages: ReadableStream<string>,
  promptId: string,
): AsyncGenerator<PromptEvent | { type: "status" }> {
  for await (const data of messages) {
    const message = JSON.parse(data) as PromptEvent | { type: "status" };
    if (message.type === "status") {
      yield message;
      continue;
    }
    if (!promptEventTypes.has(message.type)) {
      continue;
    }
    if (message.data.prompt_id !== promptId) {
      continue;
    }
    yield message;
  }
}

async function trackPrompt(
  messages: ReadableStream<string>,
  workflow: Workflow,
  promptId: string,
  ahead: () => Promise<number | undefined>,
): Promise<void> {
  let running = false;
  let lastAhead: number | undefined;
  let lastNode: string | null = null;
  let firstSample: ProgressSample | null = null;
  const title = (node: string) => workflow[node]?._meta?.title ?? node;
  for await (const event of promptEvents(messages, promptId)) {
    switch (event.type) {
      case "status": {
        if (running) {
          break;
        }
        const count = await ahead();
        if (count !== undefined && count !== lastAhead) {
          lastAhead = count;
          console.log(`waiting, ${count} ahead`);
        }
        break;
      }
      case "execution_start":
        running = true;
        lastNode = null;
        console.log("running");
        break;
      case "executing":
        if (event.data.node && event.data.node !== lastNode) {
          lastNode = event.data.node;
          firstSample = null;
          console.log(`running ${title(event.data.node)}`);
        }
        break;
      case "progress": {
        const { node, value, max } = event.data;
        if (!node || value === undefined || max === undefined) {
          throw new Error(`malformed progress event ${JSON.stringify(event)}`);
        }
        const sample = { value, time: performance.now() };
        firstSample ??= sample;
        const remaining = nodeRemaining(firstSample, sample, max);
        const nodeEta =
          remaining === undefined ? "" : `, eta ${formatDuration(remaining)}`;
        console.log(`${title(node)} ${value}/${max}${nodeEta}`);
        break;
      }
      case "execution_success":
        return;
      case "execution_error":
        throw new Error(
          `${event.data.node_type ?? event.data.node}: ${event.data.exception_message}`,
        );
      case "execution_interrupted":
        throw new Error("execution interrupted");
    }
  }
  throw new Error("websocket closed before completion");
}
