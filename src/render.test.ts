import { expect, test } from "bun:test";
import { inputsOf, type Workflow, type WorkflowNode } from "./comfy-ui";
import {
  applyInputs,
  imagePathIn,
  imagePathOf,
  loadWorkflow,
  nameOf,
  nextSeed,
  parseRequest,
  requestPathOf,
} from "./render";

function deadNodes(workflow: Workflow, output: string): string[] {
  const reached = new Set<string>();
  const visit = (node: string) => {
    if (reached.has(node)) {
      return;
    }
    reached.add(node);
    const found = workflow[node];
    if (!found) {
      throw new Error(`workflow has no node ${node}`);
    }
    for (const value of Object.values(found.inputs)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        visit(value[0]);
      }
    }
  };
  visit(output);
  return Object.keys(workflow).filter((node) => !reached.has(node));
}

test("inputs set the prompt, the seed and the output name", async () => {
  const workflow = await loadWorkflow();
  applyInputs(workflow, {
    prompt: "a cat in a hat",
    uploads: ["cat.png"],
    name: "cat",
    seed: 3,
  });
  expect(
    inputsOf(workflow, { id: "459:474", classType: "TextEncodeQwenImage21" })
      .prompt,
  ).toBe("a cat in a hat");
  expect(
    inputsOf(workflow, { id: "459:458", classType: "KSampler" }).seed,
  ).toBe(3);
  expect(
    inputsOf(workflow, { id: "461", classType: "SaveImageAdvanced" })
      .filename_prefix,
  ).toBe("qwen-image-2.1-workflows/cat");
});

test("inputs load each upload into its own image input", async () => {
  const workflow = await loadWorkflow();
  applyInputs(workflow, {
    prompt: "a cat in a hat",
    uploads: ["cat.png", "hat.png"],
    name: "cat",
    seed: 1,
  });
  const encode = inputsOf(workflow, {
    id: "459:474",
    classType: "TextEncodeQwenImage21",
  });
  expect(encode["images.image_1"]).toEqual(["470", 0]);
  expect(encode["images.image_2"]).toEqual(["470:2", 0]);
  expect(inputsOf(workflow, { id: "470", classType: "LoadImage" }).image).toBe(
    "cat.png",
  );
  expect(
    inputsOf(workflow, { id: "470:2", classType: "LoadImage" }).image,
  ).toBe("hat.png");
  expect(deadNodes(workflow, "461")).toEqual([]);
});

test("parseRequest reads the prompt and the image paths", () => {
  expect(
    parseRequest("shots/cat.png.json", {
      prompt: " a cat in a hat \n",
      images: ["cat.png", "hat.png"],
    }),
  ).toEqual({ prompt: "a cat in a hat", images: ["cat.png", "hat.png"] });
});

test("parseRequest reads the width and the height", () => {
  expect(
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: ["cat.png"],
      width: 1280,
      height: 704,
    }),
  ).toEqual({
    prompt: "a cat in a hat",
    images: ["cat.png"],
    width: 1280,
    height: 704,
  });
});

test("parseRequest reads the seed", () => {
  expect(
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: ["cat.png"],
      seed: 0,
    }),
  ).toEqual({ prompt: "a cat in a hat", images: ["cat.png"], seed: 0 });
});

test("parseRequest accepts the supported 3:2 size", () => {
  expect(
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: ["cat.png"],
      width: 2528,
      height: 1696,
    }),
  ).toEqual({
    prompt: "a cat in a hat",
    images: ["cat.png"],
    width: 2528,
    height: 1696,
  });
});

test("parseRequest rejects a size that fits inside no supported size", () => {
  expect(() =>
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: ["cat.png"],
      width: 2560,
      height: 1696,
    }),
  ).toThrow(
    "shots/cat.png.json width and height must fit inside one of 2048x2048, 2400x1792, 1792x2400, 2528x1696, 1696x2528, 2752x1536, 1536x2752",
  );
});

test("parseRequest rejects a size that is not a multiple of 32", () => {
  expect(() =>
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: ["cat.png"],
      width: 1008,
    }),
  ).toThrow("shots/cat.png.json width must be a multiple of 32");
});

test("parseRequest rejects a request without images", () => {
  expect(() =>
    parseRequest("shots/cat.png.json", { prompt: "a cat", images: [] }),
  ).toThrow("shots/cat.png.json needs a non-empty images array of paths");
});

test("imagePathIn resolves an image beside the request", () => {
  expect(imagePathIn("/shots/cat.png.json", "hat.png", "/home/ann")).toBe(
    "/shots/hat.png",
  );
});

test("imagePathIn resolves an image in the home directory", () => {
  expect(
    imagePathIn("/shots/cat.png.json", "~/hats/hat.png", "/home/ann"),
  ).toBe("/home/ann/hats/hat.png");
});

test("parseRequest accepts 10 images", () => {
  expect(
    parseRequest("shots/cat.png.json", {
      prompt: "a cat in a hat",
      images: [
        "1.png",
        "2.png",
        "3.png",
        "4.png",
        "5.png",
        "6.png",
        "7.png",
        "8.png",
        "9.png",
        "10.png",
      ],
    }),
  ).toEqual({
    prompt: "a cat in a hat",
    images: [
      "1.png",
      "2.png",
      "3.png",
      "4.png",
      "5.png",
      "6.png",
      "7.png",
      "8.png",
      "9.png",
      "10.png",
    ],
  });
});

test("imagePathOf keeps an image path", () => {
  expect(imagePathOf("shots/cat.png")).toBe("shots/cat.png");
});

test("imagePathOf drops the json extension of a request path", () => {
  expect(imagePathOf("shots/cat.png.json")).toBe("shots/cat.png");
});

test("requestPathOf names the request beside the image", () => {
  expect(requestPathOf("shots/cat.png")).toBe("shots/cat.png.json");
});

test("the latent takes its size from the first image", async () => {
  const latent = inputsOf(await loadWorkflow(), {
    id: "459:456",
    classType: "EmptyLatentImage",
  });
  expect(latent.width).toEqual(["476", 0]);
  expect(latent.height).toEqual(["476", 1]);
});

test("inputs override the latent size from the first image", async () => {
  const workflow = await loadWorkflow();
  applyInputs(workflow, {
    prompt: "a cat in a hat",
    uploads: ["cat.png"],
    name: "cat",
    seed: 1,
    width: 1280,
  });
  const latent = inputsOf(workflow, {
    id: "459:456",
    classType: "EmptyLatentImage",
  });
  expect(latent.width).toBe(1280);
  expect(latent.height).toEqual(["476", 1]);
});

test("every node feeds the saved image", async () => {
  expect(deadNodes(await loadWorkflow(), "461")).toEqual([]);
});

test("nameOf drops the png extension", () => {
  expect(nameOf("shots/cat.png")).toBe("cat");
});

test("nextSeed starts at 1 without a rendered image", () => {
  expect(
    nextSeed(
      undefined,
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat" },
    ),
  ).toBe(1);
});

test("nextSeed increments the rendered seed when the request is unchanged", () => {
  expect(
    nextSeed(
      {
        "470": {
          class_type: "LoadImage",
          inputs: { image: "cat.png" },
          is_changed: ["9df8a9a4"],
        } as WorkflowNode,
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "a cat", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 4 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "qwen-image-2.1-workflows/cat" },
        },
      },
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat" },
    ),
  ).toBe(5);
});

test("nextSeed restarts at 1 when the request changed", () => {
  expect(
    nextSeed(
      {
        "470": { class_type: "LoadImage", inputs: { image: "cat.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "a cat", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 4 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "qwen-image-2.1-workflows/cat" },
        },
      },
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat", width: 1280 },
    ),
  ).toBe(1);
});

test("nextSeed restarts at 1 when the rendered seed is not a number", () => {
  expect(
    nextSeed(
      {
        "470": { class_type: "LoadImage", inputs: { image: "cat.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "a cat", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: ["480", 0] } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "qwen-image-2.1-workflows/cat" },
        },
      },
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat" },
    ),
  ).toBe(1);
});

test("nextSeed restarts at 1 when the rendered image has no sampler node", () => {
  expect(
    nextSeed(
      {
        "3": { class_type: "KSampler", inputs: { seed: 4 } },
      },
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat" },
    ),
  ).toBe(1);
});

test("nextSeed restarts at 1 when the rendered sampler node is another class", () => {
  expect(
    nextSeed(
      {
        "459:458": { class_type: "KSamplerAdvanced", inputs: { seed: 4 } },
      },
      {
        "470": { class_type: "LoadImage", inputs: { image: "example.png" } },
        "459:474": {
          class_type: "TextEncodeQwenImage21",
          inputs: { prompt: "", "images.image_1": ["470", 0] },
        },
        "459:456": {
          class_type: "EmptyLatentImage",
          inputs: { width: ["476", 0], height: ["476", 1] },
        },
        "459:458": { class_type: "KSampler", inputs: { seed: 0 } },
        "461": {
          class_type: "SaveImageAdvanced",
          inputs: { filename_prefix: "" },
        },
      },
      { prompt: "a cat", uploads: ["cat.png"], name: "cat" },
    ),
  ).toBe(1);
});
