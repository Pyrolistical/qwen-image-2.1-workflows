const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function pngText(
  bytes: Uint8Array,
  keyword: string,
): string | undefined {
  if (!PNG_SIGNATURE.every((byte, position) => bytes[position] === byte)) {
    throw new Error("not a png");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin1 = new TextDecoder("latin1");
  let offset = PNG_SIGNATURE.length;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = latin1.decode(bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "tEXt") {
      const separator = data.indexOf(0);
      if (latin1.decode(data.subarray(0, separator)) === keyword) {
        return latin1.decode(data.subarray(separator + 1));
      }
    }
    offset += 12 + length;
  }
  return;
}
