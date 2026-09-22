# Qwen-Image 2.1 workflows

Image editing with Qwen-Image 2.1 on ComfyUI, driven by a `<name>.png.json` file next to the output image.

## Setup

- [Bun](https://bun.sh) and `bun install`
- ComfyUI with Qwen-Image 2.1 support and these models:
  - `diffusion_models/qwen_image_2.1_int8_convrot.safetensors`
  - `text_encoders/qwen3vl_8b_int8_convrot.safetensors`
  - `vae/qwen_image_2.1_vae_bf16.safetensors`

## Usage

- `bun render.ts <name>.png`
- [prompt.md](prompt.md): writing `<name>.png.json`
- [process.md](process.md): rendering and `COMFY_UI_URL`

## Workflows

- [character-turnaround-sheet](character-turnaround-sheet/process.md): a turnaround sheet for an existing character
- [outpainting](outpainting/process.md): extending the canvas past its edges

## Development

- `bun test`
- `bun run lint`
