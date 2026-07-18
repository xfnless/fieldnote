const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".text",
  ".js",
  ".mjs",
  ".ts",
  ".css",
  ".html",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".go",
  ".rs",
  ".sql",
  ".conf",
  ".ini",
]);

const encoder = new TextEncoder();

const bytesToHex = bytes =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export const createEmptyManifest = () => ({
  schema: 1,
  items: {},
});

export const isTextPath = path => {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(lower.slice(dot));
};

export const sha256Hex = async text => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
};

export const textSize = text => encoder.encode(text).byteLength;

export const createNote = async (title, content, deps = {}) => {
  const now = deps.now ?? (() => new Date().toISOString());
  const id = deps.id ?? (() => `n_${crypto.randomUUID().replaceAll("-", "")}`);
  const createdAt = now();
  const noteId = id();
  const path = `notes/${noteId}.md`;

  return {
    content,
    meta: {
      id: noteId,
      path,
      title: title.trim() || "Untitled",
      kind: "text",
      createdAt,
      updatedAt: createdAt,
      deleted: false,
      size: textSize(content),
      hash: `sha256:${await sha256Hex(content)}`,
    },
  };
};

export const mergeManifestAndContents = (manifest, contentsByPath) =>
  Object.fromEntries(
    Object.values(manifest.items).map(item => [
      item.id,
      {
        ...item,
        content: contentsByPath[item.path] ?? "",
        dirty: false,
        saving: false,
        error: "",
      },
    ]),
  );
