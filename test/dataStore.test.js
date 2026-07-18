import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEmptyManifest,
  createNote,
  isTextPath,
  mergeManifestAndContents,
} from "../src/dataStore.js";

test("createEmptyManifest returns the first schema with no items", () => {
  assert.deepEqual(createEmptyManifest(), {
    schema: 1,
    items: {},
  });
});

test("isTextPath accepts lightweight text and script files", () => {
  assert.equal(isTextPath("notes/a.md"), true);
  assert.equal(isTextPath("notes/a.sh"), true);
  assert.equal(isTextPath("files/a.png"), false);
});

test("createNote builds a stable metadata record and content write", async () => {
  const note = await createNote("VPN checklist", "remember #travel", {
    now: () => "2026-07-18T10:00:00.000Z",
    id: () => "n_test",
  });

  assert.equal(note.content, "remember #travel");
  assert.deepEqual(note.meta, {
    id: "n_test",
    path: "notes/n_test.md",
    title: "VPN checklist",
    kind: "text",
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
    deleted: false,
    size: 16,
    hash: "sha256:79ef18dd0c0d2e95ddb09f7308bda22f98d88d4ca19efc11ac99c78d826524e9",
  });
});

test("mergeManifestAndContents keeps text content in memory only", () => {
  const manifest = {
    schema: 1,
    items: {
      n_one: {
        id: "n_one",
        path: "notes/n_one.md",
        title: "One",
        kind: "text",
        createdAt: "2026-07-18T10:00:00.000Z",
        updatedAt: "2026-07-18T10:00:00.000Z",
        deleted: false,
        size: 5,
        hash: "sha256:x",
      },
    },
  };

  assert.deepEqual(mergeManifestAndContents(manifest, { "notes/n_one.md": "hello" }), {
    n_one: {
      ...manifest.items.n_one,
      content: "hello",
      dirty: false,
      saving: false,
      error: "",
    },
  });
});
