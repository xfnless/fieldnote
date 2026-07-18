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

const pad2 = value => String(value).padStart(2, "0");

const timePrefix = (date = new Date()) => {
  const year = pad2(date.getFullYear() % 100);
  const month = (date.getMonth() + 1).toString(36);
  const day = date.getDate().toString(36);
  const hour = date.getHours().toString(36);
  const minute = pad2(date.getMinutes());

  return `${year}${month}${day}${hour}${minute}`;
};

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

export const createNoteId = (items = [], date = new Date()) => {
  const prefix = timePrefix(date);
  const ids = new Set(items.map(item => item.id));
  let sequence = 0;

  while (sequence < 36 * 36) {
    const id = `${prefix}${pad2(sequence.toString(36))}`;
    if (!ids.has(id)) return id;
    sequence += 1;
  }

  throw new Error(`Too many notes created in one minute: ${prefix}`);
};

export const createNote = async (title, content, deps = {}) => {
  const now = deps.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const existingItems = deps.items ?? [];
  const id = deps.id ?? (() => createNoteId(existingItems, new Date(createdAt)));
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
