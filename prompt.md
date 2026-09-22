# Authoring `<name>.png.json`

```json
{
  "prompt": "<editing instruction>",
  "images": ["<file path>", "..."],
  "width": 1024,
  "height": 1024,
  "seed": 7
}
```

## Fields

### `prompt`

- Required. The editing instruction. See Authoring `prompt` for how to write it

### `images`

- Required. 1 to 10 image paths
- Put the canvas first. A missing `width` or `height` comes from the first image
- The order sets the tags: the first path is `<image1>`, the second is `<image2>` and so on
- Another image can be the canvas if the prompt says so

### `width` and `height`

- Optional. The output size in pixels. A missing value comes from the first image
- Each is a multiple of 32
- The size fits inside a row of the table: the width is at most its max width and the height is at most its max height
- Smaller sizes are fine, e.g. 1024x768 fits inside 2400x1792 and 1280x704 fits inside 2752x1536

| Aspect ratio | Max width | Max height |
| --- | --- | --- |
| 1:1 | 2048 | 2048 |
| 4:3 | 2400 | 1792 |
| 3:4 | 1792 | 2400 |
| 3:2 | 2528 | 1696 |
| 2:3 | 1696 | 2528 |
| 16:9 | 2752 | 1536 |
| 9:16 | 1536 | 2752 |

- Set the size when the output doesn't follow an image, such as a new scene built from references

| Scene | Aspect ratio |
| --- | --- |
| Group photo | 3:2 |
| Landscape scene | 3:2 |
| Portrait or photo shoot | 2:3 |
| Poster | 2:3 |
| Full body scene | 3:4 |
| Desktop wallpaper | 16:9 |
| Phone wallpaper | 9:16 |

- To extend the canvas, see `outpainting/process.md`

### `seed`

- Optional. A non-negative integer
- Set it to render with the same seed every run. Leave it out and the seed goes up by 1 each run

## Authoring `prompt`

### Image references

- With 2 or more images, use `<image1>`, `<image2>` and so on
- With 1 image, use `the image`
- Say which image is the canvas and what each other image adds
- In a group photo with no canvas, each image adds an identity
- Name an identity from a reference image by its tag instead of describing it
- Describe each referenced image on its own

### Text

- Put text in double quotes for it to be rendered in the output image
- Keep each piece of rendered text in one language

### Tips

- Write one paragraph that starts with the edit
- Make the edit strong and unambiguous, so the result can't be mistaken for the input
- The model drifts beyond what you name. Sharpening can shift the colors, upscaling can reframe, a restyle can alter a face
  - Name exactly what to edit, then add one short clause keeping everything else the same as the input
  - Don't describe things to keep in detail. The model redraws what you describe, so they drift
- Name things to keep by type, position and role, not by how they look
- Identity is the hardest thing to keep the same. Unless it is the edit, name what carries it among the things to keep, e.g.:
  - A person's face and signature accessories
  - A product's design, markings and count
  - The medium: photo, anime, illustration, sketch, 3D render or painting
- Use concrete words: write `soft warm light from the left` instead of `better lighting`
- Be decisive: write `red` instead of `red or orange`, and leave out `maybe` and `slightly`
- When you remove, move or reveal something, say what fills the gap
- Keep simple edits short. For new scenes, shoots and posters, describe the scene, lighting, composition and layout
- Say what to keep, not what to avoid
- Leave out resolution and aspect ratio. They come from `width` and `height` or the first image
