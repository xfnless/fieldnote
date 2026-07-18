import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decodeGitHubContent,
  encodeGitHubContent,
  parseRepoSpec,
} from "../src/githubStorage.js";

test("parseRepoSpec accepts owner/repo shorthand", () => {
  assert.deepEqual(parseRepoSpec("xfnless/fieldnote-data"), {
    owner: "xfnless",
    repo: "fieldnote-data",
  });
});

test("encodeGitHubContent round-trips unicode text", () => {
  const text = "hello 中文\n";
  assert.equal(decodeGitHubContent(encodeGitHubContent(text)), text);
});
