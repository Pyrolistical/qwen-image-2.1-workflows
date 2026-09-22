import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  ComfyClient,
  inputsOf,
  nodeOf,
  promptInPng,
  queueServer,
  type Workflow,
} from "./comfy-ui";

const WORKFLOW_PATH = join(import.meta.dirname, "workflow.json");
const ENCODE_NODE = { id: "459:474", classType: "TextEncodeQwenImage21" };
const SAMPLER_NODE = { id: "459:458", classType: "KSampler" };
const LOAD_IMAGE_NODE = { id: "470", classType: "LoadImage" };
const LATENT_NODE = { id: "459:456", classType: "EmptyLatentImage" };
const OUTPUT_NODE = { id: "461", classType: "SaveImageAdvanced" };
const IMAGE = ".png";
const REQUEST = ".json";
const SIZE_STEP = 32;
const MAX_IMAGES = 10;

interface Size {
  width?: number;
  height?: number;
}

const SUPPORTED_SIZES: Required<Size>[] = [
  { width: 2048, height: 2048 },
  { width: 2400, height: 1792 },
  { width: 1792, height: 2400 },
  { width: 2528, height: 1696 },
  { width: 1696, height: 2528 },
  { width: 2752, height: 1536 },
  { width: 1536, height: 2752 },
];

interface Request extends Size {
  prompt: string;
  images: string[];
  seed?: number;
}

interface Inputs extends Size {
  prompt: string;
  uploads: string[];
  name: string;
  seed: number;
}

export function imagePathOf(path: string): string {
  return path.endsWith(REQUEST) ? path.slice(0, -REQUEST.length) : path;
}

export function requestPathOf(imagePath: string): string {
  return `${imagePath}${REQUEST}`;
}

export function nameOf(imagePath: string): string {
  if (!imagePath.endsWith(IMAGE)) {
    throw new Error(`${imagePath} does not end with ${IMAGE}`);
  }
  return basename(imagePath, IMAGE);
}

export function parseRequest(path: string, json: unknown): Request {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error(`${path} must be a json object`);
  }
  return {
    prompt: parsePrompt(path, json),
    images: parseImages(path, json),
    ...parseSize(path, json),
    ...parseSeed(path, json),
  };
}

function parsePrompt(path: string, json: object): string {
  const prompt = "prompt" in json ? json.prompt : undefined;
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new Error(`${path} needs a prompt string`);
  }
  return prompt.trim();
}

function parseImages(path: string, json: object): string[] {
  const images = "images" in json ? json.images : undefined;
  if (
    !Array.isArray(images) ||
    !images.length ||
    !images.every((image) => typeof image === "string")
  ) {
    throw new Error(`${path} needs a non-empty images array of paths`);
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(
      `${path} has ${images.length} images, at most ${MAX_IMAGES}`,
    );
  }
  return images;
}

function parseSeed(path: string, json: object): { seed?: number } {
  if (!("seed" in json)) {
    return {};
  }
  const { seed } = json;
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0) {
    throw new Error(`${path} seed must be a non-negative integer`);
  }
  return { seed };
}

function parseSize(path: string, json: object): Size {
  const size = {
    ...parseDimension(path, "width", json),
    ...parseDimension(path, "height", json),
  };
  if (
    !SUPPORTED_SIZES.some(
      (supported) =>
        (size.width ?? 0) <= supported.width &&
        (size.height ?? 0) <= supported.height,
    )
  ) {
    const sizes = SUPPORTED_SIZES.map(
      ({ width, height }) => `${width}x${height}`,
    ).join(", ");
    throw new Error(`${path} width and height must fit inside one of ${sizes}`);
  }
  return size;
}

function parseDimension(path: string, key: keyof Size, json: object): Size {
  if (!(key in json)) {
    return {};
  }
  const value: unknown = Reflect.get(json, key);
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} ${key} must be a positive integer`);
  }
  if (value % SIZE_STEP !== 0) {
    throw new Error(`${path} ${key} must be a multiple of ${SIZE_STEP}`);
  }
  return { [key]: value };
}

async function readRequest(path: string): Promise<Request> {
  return parseRequest(path, JSON.parse(await readFile(path, "utf8")));
}

export async function loadWorkflow(): Promise<Workflow> {
  return JSON.parse(await readFile(WORKFLOW_PATH, "utf8")) as Workflow;
}

export function applyInputs(workflow: Workflow, inputs: Inputs): void {
  const template = nodeOf(workflow, LOAD_IMAGE_NODE);
  const encode = inputsOf(workflow, ENCODE_NODE);
  inputs.uploads.forEach((image, position) => {
    const node =
      position === 0
        ? LOAD_IMAGE_NODE.id
        : `${LOAD_IMAGE_NODE.id}:${position + 1}`;
    workflow[node] = { ...template, inputs: { ...template.inputs, image } };
    encode[`images.image_${position + 1}`] = [node, 0];
  });
  encode.prompt = inputs.prompt;
  const latent = inputsOf(workflow, LATENT_NODE);
  if (inputs.width !== undefined) {
    latent.width = inputs.width;
  }
  if (inputs.height !== undefined) {
    latent.height = inputs.height;
  }
  inputsOf(workflow, SAMPLER_NODE).seed = inputs.seed;
  inputsOf(workflow, OUTPUT_NODE).filename_prefix =
    `qwen-image-2.1-workflows/${inputs.name}`;
}

export function imagePathIn(
  requestPath: string,
  image: string,
  home: string,
): string {
  if (image === "~" || image.startsWith("~/")) {
    return join(home, image.slice(1));
  }
  return resolve(dirname(requestPath), image);
}

async function uploadImages(
  client: ComfyClient,
  requestPath: string,
  images: string[],
): Promise<string[]> {
  const uploads: string[] = [];
  for (const image of images) {
    const path = imagePathIn(requestPath, image, homedir());
    uploads.push(await client.uploadImage(await readFile(path), extname(path)));
  }
  return uploads;
}

async function readRendered(imagePath: string): Promise<Workflow | undefined> {
  if (!existsSync(imagePath)) {
    return;
  }
  return promptInPng(await readFile(imagePath));
}

export function nextSeed(
  rendered: Workflow | undefined,
  template: Workflow,
  inputs: Omit<Inputs, "seed">,
): number {
  if (rendered === undefined) {
    return 1;
  }
  const sampler = rendered[SAMPLER_NODE.id];
  if (sampler?.class_type !== SAMPLER_NODE.classType) {
    return 1;
  }
  const { seed } = sampler.inputs;
  if (typeof seed !== "number") {
    return 1;
  }
  const workflow = structuredClone(template);
  applyInputs(workflow, { ...inputs, seed });
  return sameGraph(workflow, rendered) ? seed + 1 : 1;
}

function sameGraph(a: Workflow, b: Workflow): boolean {
  return isDeepStrictEqual(graphOf(a), graphOf(b));
}

function graphOf(workflow: Workflow): Workflow {
  return Object.fromEntries(
    Object.entries(workflow).map(([node, { class_type, inputs }]) => [
      node,
      { class_type, inputs },
    ]),
  );
}

export async function render(): Promise<void> {
  const [, script, pathArg] = process.argv;
  if (script === undefined) {
    throw new Error("process.argv has no script path");
  }
  if (pathArg === undefined) {
    console.error(
      `usage: bun ${relative(process.cwd(), script)} <image.png|image.png.json>`,
    );
    process.exit(1);
  }

  const imagePath = imagePathOf(pathArg);
  const name = nameOf(imagePath);
  const requestPath = requestPathOf(imagePath);
  const request = await readRequest(requestPath);
  const workflow = await loadWorkflow();
  const client = new ComfyClient(await queueServer());
  const uploads = await uploadImages(client, requestPath, request.images);
  const inputs = { ...request, uploads, name };
  const seed =
    request.seed ?? nextSeed(await readRendered(imagePath), workflow, inputs);
  applyInputs(workflow, { ...inputs, seed });
  console.log(`prompt: ${inputs.prompt}`);
  console.log(`seed: ${seed}`);
  const promptId = await client.runPrompt(workflow);
  const file = await client.outputOf(promptId, OUTPUT_NODE.id);
  await writeFile(imagePath, await client.downloadImage(file));
  console.log(`wrote ${imagePath}`);
}
