# Rendering `<name>.png`

- `bun <repo>/render.ts <name>.png` from any directory
  - Also takes `<name>.png.json`
  - Joins the shortest server queue, prints how many prompts are ahead while it waits, and monitors the render until done
  - Writes the output to `<name>.png`, replacing any previous render
- Outputs are also saved on the server under `output/qwen-image-2.1-workflows/<name>_<number>_.png`

### `COMFY_UI_URL`

- Start ComfyUI listening on every interface so other machines can reach it: `python main.py --listen 0.0.0.0 --port 8188`
- `COMFY_UI_URL` is a comma separated list of ComfyUI urls, e.g. `COMFY_UI_URL=http://localhost:8188,http://10.0.0.2:8188`
  - Set it in the optional `.env` in the repo root, or as an environment variable, which overrides `.env`
  - Defaults to `http://localhost:8188`
- The render joins the shortest queue, taking the first in `COMFY_UI_URL` order on a tie
- Servers that are down are skipped. With every server down the render fails
