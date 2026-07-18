import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("editor textarea is not initialized from selected reactive item", () => {
  const textareaStart = source.indexOf("editorTextArea = textarea({");
  assert.notEqual(textareaStart, -1);

  const textareaEnd = source.indexOf("});", textareaStart);
  const textareaBlock = source.slice(textareaStart, textareaEnd);

  assert.match(textareaBlock, /value:\s*""/);
  assert.doesNotMatch(textareaBlock, /selectedItem/);
});
