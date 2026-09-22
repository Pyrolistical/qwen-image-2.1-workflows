import { expect, test } from "bun:test";
import {
  aheadIn,
  comfyUrls,
  formatDuration,
  inputsOf,
  nodeRemaining,
  promptInPng,
  shortestQueue,
  type Workflow,
} from "./comfy-ui";

test("inputsOf returns the node inputs", () => {
  const workflow: Workflow = {
    "104": {
      class_type: "WanImageToVideo",
      inputs: { width: 768, first_frame: ["114", 0] },
    },
    "114": { class_type: "LoadImage", inputs: { image: "" } },
  };
  expect(
    inputsOf(workflow, { id: "104", classType: "WanImageToVideo" }),
  ).toEqual({
    width: 768,
    first_frame: ["114", 0],
  });
});

test("inputsOf rejects a node of another type", () => {
  const workflow: Workflow = {
    "114": { class_type: "LoadImage", inputs: { image: "" } },
  };
  expect(() =>
    inputsOf(workflow, { id: "114", classType: "WanImageToVideo" }),
  ).toThrow("workflow node 114 is LoadImage, expected WanImageToVideo");
});

test("promptInPng reads the workflow of the prompt text", () => {
  const png = Buffer.from(
    "\x89PNG\r\n\x1a\n" +
      '\0\0\0\x44tEXtprompt\0{"470":{"class_type":"LoadImage","inputs":{"image":"a.png"}}}\0\0\0\0' +
      "\0\0\0\0IEND\0\0\0\0",
    "latin1",
  );
  expect(promptInPng(png)).toEqual({
    "470": { class_type: "LoadImage", inputs: { image: "a.png" } },
  });
});

test("aheadIn counts the running prompt and the pending prompts queued earlier", () => {
  expect(
    aheadIn(
      {
        queue_running: [[7, "run-7"]],
        queue_pending: [
          [10, "run-10"],
          [8, "run-8"],
          [9, "run-9"],
        ],
      },
      "run-9",
    ),
  ).toBe(2);
});

test("aheadIn is undefined once the prompt runs", () => {
  expect(
    aheadIn({ queue_running: [[9, "run-9"]], queue_pending: [] }, "run-9"),
  ).toBeUndefined();
});

test("nodeRemaining extrapolates from rate since first sample", () => {
  expect(
    nodeRemaining({ value: 1, time: 1000 }, { value: 3, time: 5000 }, 8),
  ).toBe(10000);
});

test("nodeRemaining is unknown without progress", () => {
  expect(
    nodeRemaining({ value: 1, time: 1000 }, { value: 1, time: 5000 }, 8),
  ).toBeUndefined();
});

test("formatDuration under a minute", () => {
  expect(formatDuration(42400)).toBe("42s");
});

test("formatDuration over a minute", () => {
  expect(formatDuration(125000)).toBe("2m05s");
});

test("comfyUrls splits a comma separated list", () => {
  expect(comfyUrls("http://localhost:8188/, http://10.0.0.2:8188")).toEqual([
    "http://localhost:8188",
    "http://10.0.0.2:8188",
  ]);
});

test("comfyUrls rejects an empty list", () => {
  expect(() => comfyUrls(" , ")).toThrow(
    "COMFY_UI_URL must be a comma separated list of urls",
  );
});

test("shortestQueue picks the first shortest queue", () => {
  expect(
    shortestQueue([
      ["http://a:8188", 3],
      ["http://b:8188", "down"],
      ["http://c:8188", 1],
      ["http://d:8188", 1],
    ]),
  ).toBe("http://c:8188");
});

test("shortestQueue reports every server when none is up", () => {
  expect(() =>
    shortestQueue([
      ["http://a:8188", "down"],
      ["http://b:8188", "down"],
    ]),
  ).toThrow("no comfyui server up: http://a:8188 down, http://b:8188 down");
});
