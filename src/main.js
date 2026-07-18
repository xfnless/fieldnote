import van from "https://cdn.jsdelivr.net/npm/vanjs-core@1.6.0/src/van.min.js";

const { button, div, h1, input, label, p, section } = van.tags;

const App = () => section(
  { class: "shell" },
  div(
    { class: "brand" },
    h1("Fieldnote"),
    p("Ephemeral editor. Durable text files."),
  ),
  div(
    { class: "connect" },
    label("GitHub token"),
    input({ type: "password", placeholder: "Only kept in memory" }),
    label("Repository"),
    input({ placeholder: "owner/repo" }),
    button("Connect"),
  ),
);

van.add(document.getElementById("app"), App());
