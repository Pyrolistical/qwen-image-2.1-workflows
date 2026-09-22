# Outpainting

- Extends the canvas past its edges and fills the new area
- Follows the rules in the root `prompt.md`. Run it with `bun <repo>/render.ts <name>.png` as described in the root `process.md`

## `<name>.png.json`

- Put the image to extend first
- Set `width` and `height` to the new size. Without them the output keeps the input's size and nothing extends
- Add roughly 30% to 50% more space on each side that extends, then pick the closest supported size in the root `prompt.md`

| Extend | New shape | Example |
| --- | --- | --- |
| Left or right | Wider | 1:1 to 3:2, 3:4 to 1:1 or 4:3 |
| Left and right | Much wider | 1:1 to 16:9 |
| Up or down | Taller | 1:1 to 2:3, 16:9 to 4:3 or 1:1 |
| Up and down | Much taller | 1:1 to 9:16 |
| All sides | Same shape, larger | 1024x1024 to 1536x1536 |

```json
{
  "prompt": "Extend the image to the right with outpainting, continuing the sandy beach, the shoreline and the evening sky into the new area. Keep the original part of the image unchanged.",
  "images": ["beach.png"],
  "width": 1536,
  "height": 1024
}
```

## Prompt

- The prompt must say `outpainting` explicitly
- Say which edges extend and what fills the new area
- Keep the original part of the image the same
