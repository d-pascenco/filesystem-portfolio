const ui = {
  en: {
    logo: "~/dev-path",
    explorer: "explorer",
    rootPath: "~/dev-path",
    searchLabel: "search",
    shortcuts: "/ esc ↑↓",
    searchPlaceholder: "grep...",
    promptPrefix: "$ cat ",
    siteUpdated: "updated: 2026-06-06",
    copyPath: "copy path",
    copiedPath: "copied",
    noResults: "no matches",
    source: "README.en.md"
  },
  ru: {
    logo: "~/dev-path",
    explorer: "проводник",
    rootPath: "~/dev-path",
    searchLabel: "поиск",
    shortcuts: "/ esc ↑↓",
    searchPlaceholder: "grep...",
    promptPrefix: "$ cat ",
    siteUpdated: "обновлено: 2026-06-06",
    copyPath: "копировать путь",
    copiedPath: "скопировано",
    noResults: "нет совпадений",
    source: "README.ru.md"
  }
};

const languageButtons = document.querySelectorAll("[data-lang]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const uiElements = document.querySelectorAll("[data-i18n]");
const searchInput = document.querySelector("[data-search]");
const tree = document.querySelector("[data-tree]");
const noResults = document.querySelector("[data-no-results]");
const copyPathButton = document.querySelector("[data-copy-path]");
const currentFile = document.querySelector("[data-current-file]");
const currentPath = document.querySelector("[data-current-path]");
const prompt = document.querySelector("[data-i18n='prompt']");
const documentView = document.querySelector("[data-document]");

let currentLanguage = localStorage.getItem("portfolio-language") || "en";
let currentTheme = localStorage.getItem("portfolio-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
let currentPathValue = "";
let files = [];
let collapsedFolders = JSON.parse(localStorage.getItem("portfolio-collapsed-folders") || "[]");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  const boldPattern = new RegExp("\\*\\*([^*]+)\\*\\*", "g");
  const boldItalicPattern = new RegExp("\\*\\*\\*([^*]+)\\*\\*\\*", "g");
  const italicPattern = new RegExp("(^|[^*])\\*([^*]+)\\*", "g");
  const strikePattern = new RegExp("~~([^~]+)~~", "g");
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(boldItalicPattern, "<strong><em>$1</em></strong>")
    .replace(boldPattern, "<strong>$1</strong>")
    .replace(strikePattern, "<del>$1</del>")
    .replace(italicPattern, "$1<em>$2</em>");
}

function closeList(state, html) {
  if (state.type) {
    html.push(`</${state.type}>`);
    state.type = "";
  }
}

function isTableDivider(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function tableCells(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdown(markdown) {
  const lines = markdown.trim().split("\n");
  const html = [];
  const listState = { type: "" };
  let codeOpen = false;
  let codeLanguage = "";
  let codeLines = [];
  let blockquote = [];

  function flushCode() {
    if (codeOpen) {
      html.push(`<pre><code class="language-${escapeHtml(codeLanguage)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeOpen = false;
      codeLanguage = "";
      codeLines = [];
    }
  }

  function flushBlockquote() {
    if (blockquote.length) {
      html.push(`<blockquote>${renderMarkdown(blockquote.join("\n"))}</blockquote>`);
      blockquote = [];
    }
  }

  function openList(type) {
    if (listState.type !== type) {
      closeList(listState, html);
      html.push(`<${type}>`);
      listState.type = type;
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (codeOpen) {
        flushCode();
      } else {
        closeList(listState, html);
        flushBlockquote();
        codeOpen = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      return;
    }

    if (codeOpen) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      closeList(listState, html);
      flushBlockquote();
      return;
    }

    if (trimmed.startsWith("> ")) {
      closeList(listState, html);
      blockquote.push(trimmed.slice(2));
      return;
    }

    flushBlockquote();

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeList(listState, html);
      html.push("<hr>");
      return;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      openList("ul");
      const task = unordered[1].match(/^\[( |x|X)\]\s+(.+)$/);
      if (task) {
        const checked = task[1].toLowerCase() === "x" ? " checked" : "";
        html.push(`<li class="task"><input type="checkbox" disabled${checked}>${inlineMarkdown(task[2])}</li>`);
      } else {
        html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      }
      return;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      return;
    }

    closeList(listState, html);

    if (trimmed.includes("|") && lines[index + 1] && isTableDivider(lines[index + 1].trim())) {
      const headers = tableCells(trimmed);
      const rows = [];
      let rowIndex = index + 2;

      lines[index + 1] = "";

      while (lines[rowIndex] && lines[rowIndex].includes("|") && lines[rowIndex].trim()) {
        rows.push(tableCells(lines[rowIndex].trim()));
        lines[rowIndex] = "";
        rowIndex += 1;
      }

      html.push("<table><thead><tr>");
      headers.forEach((header) => html.push(`<th>${inlineMarkdown(header)}</th>`));
      html.push("</tr></thead><tbody>");
      rows.forEach((row) => {
        html.push("<tr>");
        row.forEach((cell) => html.push(`<td>${inlineMarkdown(cell)}</td>`));
        html.push("</tr>");
      });
      html.push("</tbody></table>");
      return;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
      html.push(trimmed);
      return;
    }

    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  });

  flushCode();
  flushBlockquote();
  closeList(listState, html);

  return html.join("");
}

function parseFiles(markdown) {
  const parsed = [];
  const lines = markdown.split("\n");
  let current = null;

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      current = current
        ? { ...current, codeOpen: !current.codeOpen }
        : current;
    }

    const boundary = line.match(/^##\s+(.+\.md)\s*$/);
    if (boundary && !current?.codeOpen) {
      if (current) {
        parsed.push(current);
      }
      current = {
        path: boundary[1].trim(),
        markdown: [],
        codeOpen: false
      };
      return;
    }

    if (current) {
      current.markdown.push(line);
    }
  });

  if (current) {
    parsed.push(current);
  }

  return parsed.map((file) => ({
    path: file.path,
    html: renderMarkdown(file.markdown.join("\n")),
    search: `${file.path} ${file.markdown.join(" ")}`.toLowerCase()
  }));
}

function basename(path) {
  return path.split("/").pop();
}

function foldername(path) {
  const parts = path.split("/");
  return parts.length > 1 ? `${parts[0]}/` : "";
}

function saveCollapsedFolders() {
  localStorage.setItem("portfolio-collapsed-folders", JSON.stringify(collapsedFolders));
}

function renderUi() {
  uiElements.forEach((element) => {
    const value = ui[currentLanguage][element.dataset.i18n];
    if (value) {
      element.textContent = value;
    }
  });
  searchInput.placeholder = ui[currentLanguage].searchPlaceholder;
  if (copyPathButton.dataset.copied !== "true") {
    copyPathButton.textContent = ui[currentLanguage].copyPath;
  }
  themeToggle.textContent = `theme: ${currentTheme}`;
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("portfolio-theme", theme);
  themeToggle.textContent = `theme: ${theme}`;
}

function renderTree() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = files.filter((file) => !query || file.search.includes(query));
  const groups = new Map();

  tree.innerHTML = "";

  visible.forEach((file) => {
    const folder = foldername(file.path);
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder).push(file);
  });

  groups.forEach((groupFiles, folder) => {
    const isCollapsed = !query && collapsedFolders.includes(folder);

    if (folder) {
      const folderNode = document.createElement("button");
      folderNode.className = `folder${isCollapsed ? " collapsed" : ""}`;
      folderNode.type = "button";
      folderNode.setAttribute("role", "listitem");
      folderNode.textContent = folder;
      folderNode.addEventListener("click", () => {
        collapsedFolders = collapsedFolders.includes(folder)
          ? collapsedFolders.filter((item) => item !== folder)
          : [...collapsedFolders, folder];
        saveCollapsedFolders();
        renderTree();
      });
      tree.append(folderNode);
    }

    groupFiles.forEach((file) => {
      const button = document.createElement("button");
      button.className = `file${folder ? " nested" : ""}${file.path === currentPathValue ? " active" : ""}${isCollapsed ? " collapsed" : ""}`;
      button.type = "button";
      button.dataset.path = file.path;
      button.innerHTML = `<span class="file-indent"></span><span class="file-icon">md</span><span>${escapeHtml(basename(file.path))}</span>`;
      button.addEventListener("click", () => selectFile(file.path));
      tree.append(button);
    });
  });

  noResults.classList.toggle("hidden", Boolean(visible.length) || !query);
  tree.append(noResults);

  if (visible.length && !visible.some((file) => file.path === currentPathValue)) {
    selectFile(visible[0].path);
  }
}

function selectFile(path) {
  const file = files.find((item) => item.path === path);
  if (!file) {
    return;
  }
  currentPathValue = file.path;
  currentFile.textContent = basename(file.path);
  currentPath.textContent = `~/dev-path/${file.path}`;
  prompt.textContent = `${ui[currentLanguage].promptPrefix}${file.path}`;
  documentView.innerHTML = file.html;
  tree.querySelectorAll(".file").forEach((button) => {
    button.classList.toggle("active", button.dataset.path === file.path);
  });
}

function visibleFilePaths() {
  return [...tree.querySelectorAll(".file")].map((button) => button.dataset.path);
}

function moveSelection(direction) {
  const paths = visibleFilePaths();
  if (!paths.length) {
    return;
  }
  const activeIndex = paths.indexOf(currentPathValue);
  const nextIndex = activeIndex === -1 ? 0 : (activeIndex + direction + paths.length) % paths.length;
  selectFile(paths[nextIndex]);
}

function copyCurrentPath() {
  const value = currentPath.textContent;
  const done = () => {
    copyPathButton.dataset.copied = "true";
    copyPathButton.textContent = ui[currentLanguage].copiedPath;
    window.setTimeout(() => {
      copyPathButton.dataset.copied = "false";
      copyPathButton.textContent = ui[currentLanguage].copyPath;
    }, 1200);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(value).then(done);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  done();
}

async function loadContent(language) {
  currentLanguage = language;
  document.documentElement.lang = language;
  localStorage.setItem("portfolio-language", language);
  renderUi();

  const response = await fetch(ui[language].source);
  const markdown = await response.text();
  files = parseFiles(markdown);

  if (!files.some((file) => file.path === currentPathValue)) {
    currentPathValue = files[0]?.path || "";
  }

  renderTree();
  selectFile(currentPathValue);
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    languageButtons.forEach((item) => item.classList.toggle("active", item === button));
    loadContent(button.dataset.lang);
  });
});

searchInput.addEventListener("input", renderTree);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const firstPath = visibleFilePaths()[0];
    if (firstPath) {
      selectFile(firstPath);
    }
  }
});

copyPathButton.addEventListener("click", copyCurrentPath);

themeToggle.addEventListener("click", () => {
  setTheme(currentTheme === "dark" ? "light" : "dark");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key === "Escape") {
    if (searchInput.value) {
      searchInput.value = "";
      renderTree();
    }
    searchInput.blur();
  }

  if (document.activeElement === searchInput) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  }
});

languageButtons.forEach((button) => {
  button.classList.toggle("active", button.dataset.lang === currentLanguage);
});

setTheme(currentTheme);
loadContent(currentLanguage);
