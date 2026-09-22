# Character turnaround sheet

- Makes a character turnaround sheet by redrawing the blank mannequins in `layout.png` as the character
- Follows the rules in the root `prompt.md`. Run it with `bun <repo>/render.ts <name>.png` as described in the root `process.md`

## Template layout

- `layout.png` is 1024x768 (4:3) with a white background, grey panel dividers and dashed horizontal guide lines
- Large left panel: full body front view, right side profile, back view
- Top right panel: front head and neck close-up
- Bottom right panel: three-quarter head and neck close-up turned to the right

## `<name>.png.json`

- Put `layout.png` first. The prompt below uses it as `<image1>`, the canvas
- Put the character images after it as `<image2>`, `<image3>`, ...
- `width` and `height` are 2400x1792, the largest supported 4:3 size

```json
{
  "prompt": "<prompt below>",
  "images": [
    "<path to character-turnaround-sheet/layout.png>",
    "<path to a character image>",
    "<path to another character image>"
  ],
  "width": 2400,
  "height": 1792
}
```

## Choosing what each image supplies

- Look at every character image and list the traits the sheet needs: face, hair, skin, body, outfit, footwear, accessories, art style
- The images may disagree, e.g. different outfits, hair lengths or art styles. Decide which image leads for each trait
- A trait can come from more than one image, e.g. the face from `<image2>` and its side profile from `<image3>`. Say what each image adds
- Name each image in its own sentence
- Only name traits the image actually shows
- A trait no image shows from behind or the side is drawn as the continuation of the front design

## Prompt

- Fixed part: the layout and views
- `<sources>`: one sentence per character image naming what it supplies

```
Replace the five blank mannequin figures in <image1> with the character described below, turning <image1> into a finished character turnaround sheet. Keep the layout of <image1> exactly: the white background, the thin grey panel dividers, the dashed horizontal guide lines, and the position, scale and view angle of every figure. In the large left panel draw the character full body three times, left to right: a front view, a right side profile and a back view, each in the mannequins' standing pose. In the top right panel draw a front view close-up of the character's head and neck, and in the bottom right panel draw a three-quarter view close-up of the character's head and neck turned to the right. <sources> Keep the character identical across all five views.
```

