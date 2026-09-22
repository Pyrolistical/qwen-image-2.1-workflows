import { expect, test } from "bun:test";
import { pngText } from "./png";

test("pngText reads the text of a keyword", () => {
  const png = Buffer.from(
    "\x89PNG\r\n\x1a\n" +
      "\0\0\0\x0atEXtseed\x0012345\0\0\0\0" +
      '\0\0\0\x0etEXtprompt\0{"a":1}\0\0\0\0' +
      "\0\0\0\0IEND\0\0\0\0",
    "latin1",
  );
  expect(pngText(png, "prompt")).toBe('{"a":1}');
});

test("pngText is undefined without the keyword", () => {
  const png = Buffer.from(
    "\x89PNG\r\n\x1a\n" +
      "\0\0\0\x0atEXtseed\x0012345\0\0\0\0" +
      "\0\0\0\0IEND\0\0\0\0",
    "latin1",
  );
  expect(pngText(png, "prompt")).toBeUndefined();
});
