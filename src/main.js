import van from "https://cdn.jsdelivr.net/npm/vanjs-core@1.6.0/src/van.min.js";

import {
  createEmptyManifest,
  createNote,
  mergeManifestAndContents,
} from "./dataStore.js";
import { createGitHubStorage, parseRepoSpec } from "./githubStorage.js";

const {
  button,
  div,
  form,
  h1,
  header,
  input,
  label,
  li,
  main,
  p,
  section,
  span,
  textarea,
  ul,
} = van.tags;

const MANIFEST_PATH = ".fieldnote/manifest.json";

const state = {
  connected: van.state(false),
  connecting: van.state(false),
  status: van.state("Not connected"),
  query: van.state(""),
  selectedId: van.state(""),
  manifest: van.state(createEmptyManifest()),
  manifestSha: van.state(""),
  items: van.state({}),
};

let storage = null;

const sortedItems = () =>
  Object.values(state.items.val)
    .filter(item => !item.deleted)
    .filter(item => {
      const query = state.query.val.trim().toLowerCase();
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const selectedItem = () => state.items.val[state.selectedId.val] || null;

const setStatus = message => {
  state.status.val = message;
};

const loadManifest = async () => {
  const loaded = await storage.getText(MANIFEST_PATH);
  if (loaded) {
    state.manifest.val = JSON.parse(loaded.text);
    state.manifestSha.val = loaded.sha;
    return;
  }

  const manifest = createEmptyManifest();
  const saved = await storage.putText(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", {
    message: "Initialize Fieldnote manifest",
  });
  state.manifest.val = manifest;
  state.manifestSha.val = saved.sha;
};

const loadItems = async () => {
  const contents = {};
  const textItems = Object.values(state.manifest.val.items).filter(item => item.kind === "text");

  for (const item of textItems) {
    const loaded = await storage.getText(item.path);
    contents[item.path] = loaded?.text ?? "";
  }

  state.items.val = mergeManifestAndContents(state.manifest.val, contents);
  state.selectedId.val = sortedItems()[0]?.id ?? "";
};

const connect = async event => {
  event.preventDefault();
  if (state.connecting.val) return;

  const data = new FormData(event.currentTarget);
  const token = String(data.get("token") || "").trim();
  const repoSpec = String(data.get("repo") || "").trim();
  const branch = String(data.get("branch") || "main").trim() || "main";
  const root = String(data.get("root") || "").trim();

  if (!token || !repoSpec) {
    setStatus("Token and repository are required");
    return;
  }

  try {
    state.connecting.val = true;
    setStatus("Connecting...");
    const { owner, repo } = parseRepoSpec(repoSpec);
    storage = createGitHubStorage({ token, owner, repo, branch, root });
    await loadManifest();
    await loadItems();
    state.connected.val = true;
    setStatus("Connected");
  } catch (error) {
    state.connected.val = false;
    setStatus(error.message);
  } finally {
    state.connecting.val = false;
  }
};

const saveManifest = async message => {
  const saved = await storage.putText(
    MANIFEST_PATH,
    JSON.stringify(state.manifest.val, null, 2) + "\n",
    {
      sha: state.manifestSha.val || undefined,
      message,
    },
  );
  state.manifestSha.val = saved.sha;
};

const createNewNote = async () => {
  if (!storage) return;

  try {
    setStatus("Creating note...");
    const title = state.query.val.trim() || "Untitled";
    const note = await createNote(title, "", {
      items: Object.values(state.manifest.val.items),
    });

    const file = await storage.putText(note.meta.path, note.content, {
      message: `Create ${note.meta.title}`,
    });

    state.manifest.val = {
      ...state.manifest.val,
      items: {
        ...state.manifest.val.items,
        [note.meta.id]: {
          ...note.meta,
          fileSha: file.sha,
        },
      },
    };
    await saveManifest(`Add ${note.meta.title}`);

    state.items.val = {
      ...state.items.val,
      [note.meta.id]: {
        ...note.meta,
        fileSha: file.sha,
        content: "",
        dirty: false,
        saving: false,
        error: "",
      },
    };
    state.selectedId.val = note.meta.id;
    setStatus("Created");
  } catch (error) {
    setStatus(error.message);
  }
};

const updateSelectedContent = content => {
  const item = selectedItem();
  if (!item) return;

  state.items.val = {
    ...state.items.val,
    [item.id]: {
      ...item,
      content,
      dirty: content !== item.content || item.dirty,
      error: "",
    },
  };
};

const saveSelected = async () => {
  const item = selectedItem();
  if (!storage || !item || item.saving) return;

  try {
    state.items.val = {
      ...state.items.val,
      [item.id]: { ...item, saving: true, error: "" },
    };
    setStatus("Saving...");

    const nextNote = await createNote(item.title, item.content, {
      now: () => new Date().toISOString(),
      id: () => item.id,
    });

    const file = await storage.putText(item.path, item.content, {
      sha: item.fileSha,
      message: `Update ${item.title}`,
    });

    const nextMeta = {
      ...state.manifest.val.items[item.id],
      updatedAt: nextNote.meta.updatedAt,
      size: nextNote.meta.size,
      hash: nextNote.meta.hash,
      fileSha: file.sha,
    };

    state.manifest.val = {
      ...state.manifest.val,
      items: {
        ...state.manifest.val.items,
        [item.id]: nextMeta,
      },
    };
    await saveManifest(`Update ${item.title}`);

    state.items.val = {
      ...state.items.val,
      [item.id]: {
        ...nextMeta,
        content: item.content,
        dirty: false,
        saving: false,
        error: "",
      },
    };
    setStatus("Saved");
  } catch (error) {
    const current = selectedItem();
    if (current) {
      state.items.val = {
        ...state.items.val,
        [current.id]: { ...current, saving: false, error: error.message },
      };
    }
    setStatus(error.message);
  }
};

const softDeleteSelected = async () => {
  const item = selectedItem();
  if (!storage || !item) return;
  if (!confirm(`Delete "${item.title}"?`)) return;

  try {
    const deletedAt = new Date().toISOString();
    const nextMeta = {
      ...state.manifest.val.items[item.id],
      deleted: true,
      deletedAt,
      updatedAt: deletedAt,
    };

    state.manifest.val = {
      ...state.manifest.val,
      items: {
        ...state.manifest.val.items,
        [item.id]: nextMeta,
      },
    };
    await saveManifest(`Delete ${item.title}`);

    const nextItems = { ...state.items.val };
    delete nextItems[item.id];
    state.items.val = nextItems;
    state.selectedId.val = sortedItems()[0]?.id ?? "";
    setStatus("Deleted");
  } catch (error) {
    setStatus(error.message);
  }
};

window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSelected();
  }
});

window.addEventListener("beforeunload", event => {
  if (Object.values(state.items.val).some(item => item.dirty)) {
    event.preventDefault();
  }
});

const ConnectView = () => form(
  { class: "connect", onsubmit: connect },
  label("GitHub token"),
  input({ name: "token", type: "password", autocomplete: "off", placeholder: "Only kept in memory" }),
  label("Data repository"),
  input({ name: "repo", placeholder: "xfnless/fieldnote-data" }),
  label("Branch"),
  input({ name: "branch", value: "main" }),
  label("Root path"),
  input({ name: "root", placeholder: "optional, e.g. fieldnote" }),
  button({ disabled: state.connecting }, () => state.connecting.val ? "Connecting..." : "Connect"),
);

const Sidebar = () => section(
  { class: "sidebar" },
  input({
    class: "search",
    placeholder: "Search or new note title",
    value: state.query,
    oninput: event => {
      state.query.val = event.target.value;
    },
  }),
  button({ class: "new-note", onclick: createNewNote }, "New note"),
  () => ul(
    { class: "note-list" },
    sortedItems().map(item => li(
      {
        class: () => item.id === state.selectedId.val ? "note selected" : "note",
        onclick: () => {
          state.selectedId.val = item.id;
        },
      },
      span({ class: "note-title" }, item.title),
      span({ class: "note-meta" }, `${item.size} bytes`),
    )),
  ),
);

const Editor = () => section(
  { class: "editor" },
  () => {
    const item = selectedItem();
    if (!item) {
      return div({ class: "empty" }, "Create a note to begin.");
    }

    return div(
      { class: "editor-inner" },
      div(
        { class: "editor-bar" },
        span(item.title),
        span({ class: "save-state" }, item.saving ? "saving" : item.dirty ? "dirty" : "saved"),
        button({ onclick: saveSelected }, "Save"),
        button({ class: "danger", onclick: softDeleteSelected }, "Delete"),
      ),
      textarea({
        class: "note-editor",
        value: item.content,
        spellcheck: "false",
        oninput: event => updateSelectedContent(event.target.value),
      }),
      item.error ? p({ class: "error" }, item.error) : "",
    );
  },
);

const App = () => main(
  { class: "shell" },
  header(
    { class: "topbar" },
    div(
      h1("Fieldnote"),
      p("Credentials stay in memory. Text stays in your GitHub data repo."),
    ),
    span({ class: "status" }, state.status),
  ),
  () => state.connected.val
    ? div({ class: "workspace" }, Sidebar(), Editor())
    : ConnectView(),
);

van.add(document.getElementById("app"), App());
