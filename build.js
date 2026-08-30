import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { marked } from "marked"

import { PROJECTS } from "./projects/registry.js"

const ROOT = path.dirname(fileURLToPath(import.meta.url))

const DIST_DIR = path.join(ROOT, "dist")
const PROJECTS_DIR = path.join(ROOT, "projects")
const PUBLICATIONS_DIR = path.join(ROOT, "publications")
const SITE_CONFIG_PATH = path.join(ROOT, "config", "site.config.js")

const SITE_CONFIG = (await import(`file://${SITE_CONFIG_PATH}?v=${Date.now()}`))
  .SITE_CONFIG

const LOCALES = SITE_CONFIG.supportedLocales
const DEFAULT_LOCALE = SITE_CONFIG.defaultLocale
const BASE_PATH = SITE_CONFIG.basePath.replace(/\/$/, "")

const PUBLICATION_CSS = `${BASE_PATH}/components/publications/publication.css`

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

async function removeDir(directory) {
  await fs.rm(directory, {
    recursive: true,
    force: true,
  })
}

async function ensureDir(directory) {
  await fs.mkdir(directory, {
    recursive: true,
  })
}

async function copy(source, destination) {
  await ensureDir(path.dirname(destination))

  await fs.cp(source, destination, {
    recursive: true,
  })
}

async function readTemplate(filePath) {
  if (!(await fileExists(filePath))) {
    throw new Error(`Template not found: ${filePath}`)
  }

  return fs.readFile(filePath, "utf8")
}

function renderTemplate(template, {
  locale,
  metadata = {},
  content = "",
  replacements = {},
}) {
  let html = template

  const values = {
    locale,
    title: metadata.title || "",
    description: metadata.description || "",
    content,
    ...replacements,
  }

  for (const [key, value] of Object.entries(values)) {
    const marker = `{{${key}}}`

    html = html.replaceAll(
      marker,
      String(value ?? "")
    )
  }

  return html
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char])
  )
}

function localeCode(locale) {
  return locale.split("-")[0]
}

function localeLabel(locale) {
  return localeCode(locale).toUpperCase()
}

function isRu(locale) {
  return localeCode(locale) === "ru"
}

function slugFromDirectory(directory) {
  return path.basename(directory)
}

/* -------------------------------------------------------------------------- */
/* FRONT MATTER                                                               */
/* -------------------------------------------------------------------------- */

function parseFrontMatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)

  if (!match) {
    return {
      data: {},
      content: source,
    }
  }

  const data = {}

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":")

    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else if (value === "true") {
      value = true
    } else if (value === "false") {
      value = false
    }

    data[key] = value
  }

  return {
    data,
    content: source.slice(match[0].length),
  }
}

/* -------------------------------------------------------------------------- */
/* SITE NAVIGATION                                                            */
/* -------------------------------------------------------------------------- */

function siteNavigation({ locale, active }) {
  const ru = isRu(locale)

  return `
    <a
      href="${BASE_PATH}/"
      data-nav="home"
      ${active === "home" ? 'aria-current="page"' : ""}
    >
      ${ru ? "Главная" : "Home"}
    </a>

    ${
      SITE_CONFIG.navigation.showProjects
        ? `
        <a
          href="${BASE_PATH}/projects/"
          data-nav="projects"
          ${active === "projects" ? 'aria-current="page"' : ""}
        >
          ${ru ? "Проекты" : "Projects"}
        </a>
      `
        : ""
    }

    ${
      SITE_CONFIG.navigation.showPublications
        ? `
        <a
          href="${BASE_PATH}/publications/"
          data-nav="publications"
          ${active === "publications" ? 'aria-current="page"' : ""}
        >
          ${ru ? "Публикации" : "Publications"}
        </a>
      `
        : ""
    }

    ${
      SITE_CONFIG.navigation.showAbout
        ? `
        <a
          href="${BASE_PATH}/about/"
          data-nav="about"
          ${active === "about" ? 'aria-current="page"' : ""}
        >
          ${ru ? "Обо мне" : "About"}
        </a>
      `
        : ""
    }
  `
}

function projectNavigation({ locale, project }) {
  return `
    ${siteNavigation({
      locale,
      active: 'projects'
    })}

    <a
      href="${BASE_PATH}${project.route}"
      data-nav="project"
      aria-current="page"
    >
      ${escapeHtml(
        project.meta?.[localeCode(locale)]?.name || project.id
      )}
    </a>
  `;
}

/* -------------------------------------------------------------------------- */
/* SOURCE COPY                                                                */
/* -------------------------------------------------------------------------- */

async function copySiteSource() {
  const entries = await fs.readdir(ROOT, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    if (
      entry.name === "dist" ||
      entry.name === "node_modules" ||
      entry.name === ".git"
    ) {
      continue
    }

    await copy(path.join(ROOT, entry.name), path.join(DIST_DIR, entry.name))
  }
}

/*
 * Markdown-файлы и служебные файлы проектов не должны
 * попадать в готовый сайт.
 *
 * При этом index.html и config.js остаются.
 */
async function cleanProjectOutput(project) {
  const outputDir = path.join(DIST_DIR, "projects", project.id)

  if (!(await fileExists(outputDir))) {
    return
  }

  async function walk(directory) {
    const entries = await fs.readdir(directory, {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".md")
      ) {
        await fs.rm(fullPath, {
          force: true,
        })
      }
    }
  }

  await walk(outputDir)
}

/* -------------------------------------------------------------------------- */
/* PUBLICATIONS                                                               */
/* -------------------------------------------------------------------------- */

function publicationTemplate({
  locale,
  metadata,
  html,
  slug,
  availableLocales,
}) {
  const ru = isRu(locale)

  const title = metadata.title || slug
  const description = metadata.description || ""

  const languageLinks = availableLocales
    .map(
      (item) => `
        <a
          class="publication-language${item === locale ? " active" : ""}"
          href="${BASE_PATH}/publications/${encodeURIComponent(slug)}/${item}/"
          ${item === locale ? 'aria-current="page"' : ""}
        >
          ${localeLabel(item)}
        </a>
      `
    )
    .join("")

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">

<head>
  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <title>${escapeHtml(title)} — ESCA7A</title>

  <link
    rel="stylesheet"
    href="${BASE_PATH}/css/style.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/navigation/navigation.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/publications/publication.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/footer/footer.css"
  >
</head>

<body>

<header class="site-header">

  <div class="nav-shell">

    <a
      class="brand"
      href="${BASE_PATH}/"
      aria-label="ESCA7A"
    >
      ESCA7A<span>.</span>
    </a>

    <nav
      class="nav-links"
      aria-label="${ru ? "Основная навигация" : "Primary navigation"}"
    >

      <a href="${BASE_PATH}/">
        ${ru ? "Главная" : "Home"}
      </a>

      ${
        SITE_CONFIG.navigation.showProjects
          ? `
            <a href="${BASE_PATH}/projects/">
              ${ru ? "Проекты" : "Projects"}
            </a>
          `
          : ""
      }

      ${
        SITE_CONFIG.navigation.showPublications
          ? `
            <a
              href="${BASE_PATH}/publications/"
              aria-current="page"
            >
              ${ru ? "Публикации" : "Publications"}
            </a>
          `
          : ""
      }

      ${
        SITE_CONFIG.navigation.showAbout
          ? `
            <a href="${BASE_PATH}/about/">
              ${ru ? "Обо мне" : "About"}
            </a>
          `
          : ""
      }

    </nav>

    <div class="nav-actions">

      ${
        SITE_CONFIG.navigation.showLanguageSwitcher
          ? `
            <label class="language-switcher">

              <span class="sr-only">
                ${ru ? "Язык" : "Language"}
              </span>

              <select
                data-language
                aria-label="${ru ? "Язык" : "Language"}"
              >
                ${LOCALES.map(
                  (item) => `
                    <option
                      value="${escapeHtml(item)}"
                      ${item === locale ? "selected" : ""}
                    >
                      ${localeLabel(item)}
                    </option>
                  `
                ).join("")}
              </select>

            </label>
          `
          : ""
      }

      <a
        class="nav-github"
        href="${escapeHtml(SITE_CONFIG.social.github)}"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>

    </div>

  </div>

</header>

<main class="publication-page section-shell">

  <article class="publication-content">

    <header class="publication-title">

      <div class="section-kicker">
        ${ru ? "ПУБЛИКАЦИЯ" : "PUBLICATION"}
      </div>

      <h1>
        ${escapeHtml(title)}
      </h1>

      ${
        description
          ? `
            <p class="publication-description">
              ${escapeHtml(description)}
            </p>
          `
          : ""
      }

      ${
        metadata.date
          ? `
            <time datetime="${escapeHtml(metadata.date)}">
              ${escapeHtml(metadata.date)}
            </time>
          `
          : ""
      }

    </header>

    <div class="publication-body">
      ${html}
    </div>

  </article>

</main>

<footer class="site-footer">

  <div class="footer-shell">

    <span>
      © ${new Date().getFullYear()} ESCA7A —
      ${ru
        ? "Инструменты для CS2 и FACEIT."
        : "Tools for CS2 and FACEIT."}
    </span>

    <a
      href="${escapeHtml(SITE_CONFIG.social.github)}"
      target="_blank"
      rel="noreferrer"
    >
      GitHub ↗
    </a>

  </div>

</footer>

</body>
</html>`
}

async function findPublicationDirectories() {
  const entries = await fs.readdir(PUBLICATIONS_DIR, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PUBLICATIONS_DIR, entry.name))
}

async function buildPublication(directory) {
  const slug = slugFromDirectory(directory)

  const entries = await fs.readdir(directory, { withFileTypes: true })

  const markdownFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")
  )

  const availableLocales = markdownFiles
    .map((file) => file.name.replace(/\.md$/i, ""))
    .filter((locale) => LOCALES.includes(locale))
    .sort((a, b) => LOCALES.indexOf(a) - LOCALES.indexOf(b))

  if (!availableLocales.length) {
    return null
  }

  const metadataByLocale = {}

  for (const locale of availableLocales) {
    const filePath = path.join(directory, `${locale}.md`)

    const source = await fs.readFile(filePath, "utf8")

    const parsed = parseFrontMatter(source)

    metadataByLocale[locale] = parsed.data

    const html = marked.parse(parsed.content, {
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false,
    })

    const outputDir = path.join(DIST_DIR, "publications", slug, locale)

    await ensureDir(outputDir)

    await fs.writeFile(
      path.join(outputDir, "index.html"),
      publicationTemplate({
        locale,
        metadata: parsed.data,
        html,
        slug,
        availableLocales,
      })
    )
  }

  return {
    slug,
    availableLocales,
    metadataByLocale,
  }
}

function publicationListTemplate({ locale, publications }) {
  const ru = isRu(locale)

  const title = ru ? "Публикации" : "Publications"

  const description = ru
    ? "Статьи, заметки и разборы о Counter-Strike 2, FACEIT и соревновательной игре."
    : "Articles, notes and reviews about Counter-Strike 2, FACEIT and competitive gaming."

  const cards = publications
    .map((item) => {
      const metadata =
        item.metadataByLocale[locale] ||
        item.metadataByLocale[DEFAULT_LOCALE] ||
        {}

      return `
          <a
            class="publication-card"
            href="${BASE_PATH}/publications/${encodeURIComponent(item.slug)}/"
          >

            <div class="publication-card-meta">

              <span>
                ${escapeHtml(metadata.category || "CS2")}
              </span>

              ${
                metadata.date
                  ? `<time>
                      ${escapeHtml(metadata.date)}
                    </time>`
                  : ""
              }

            </div>

            <h2>
              ${escapeHtml(metadata.title || item.slug)}
            </h2>

            ${
              metadata.description
                ? `<p>
                    ${escapeHtml(metadata.description)}
                  </p>`
                : ""
            }

            <span class="publication-card-link">
              ${ru ? "Читать" : "Read"} <b>↗</b>
            </span>

          </a>
        `
    })
    .join("")

  const languageSwitcher = SITE_CONFIG.navigation.showLanguageSwitcher
    ? `
        <label class="language-switcher">

          <span class="sr-only">
            ${ru ? "Язык" : "Language"}
          </span>

          <select
            data-language
            aria-label="${ru ? "Язык" : "Language"}"
          >
            ${LOCALES.map(
              (item) => `
              <option
                value="${escapeHtml(item)}"
                ${item === locale ? "selected" : ""}
              >
                ${localeLabel(item)}
              </option>
            `
            ).join("")}
          </select>

        </label>
      `
    : ""

  const navigation = siteNavigation({
    locale,
    active: "publications",
  })

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <title>
    ${escapeHtml(title)} — ESCA7A
  </title>

  <link
    rel="stylesheet"
    href="${BASE_PATH}/css/style.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/navigation/navigation.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/publications/publications.css"
  >

  <link
    rel="stylesheet"
    href="${BASE_PATH}/components/footer/footer.css"
  >

</head>

<body>

<header class="site-header">

  <div class="nav-shell">

    <a
      class="brand"
      href="${BASE_PATH}/"
      aria-label="ESCA7A"
    >
      ESCA7A<span>.</span>
    </a>

    <nav
      class="nav-links"
      aria-label="${ru ? "Основная навигация" : "Primary navigation"}"
    >
      ${navigation}
    </nav>

    <div class="nav-actions">

      ${languageSwitcher}

      <a
        class="nav-github"
        href="${escapeHtml(SITE_CONFIG.social.github)}"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>

    </div>

  </div>

</header>

<main class="publications-page section-shell">

  <section class="publications-intro">

    <div class="section-kicker">
      ${ru ? "ПУБЛИКАЦИИ" : "PUBLICATIONS"}
    </div>

    <h1>
      ${escapeHtml(title)}
    </h1>

    <p>
      ${escapeHtml(description)}
    </p>

  </section>

  <section class="publications-grid">

    ${
      cards ||
      `
        <div class="publications-empty">
          <span>
            ${ru ? "ПОКА ПУСТО" : "COMING SOON"}
          </span>
        </div>
      `
    }

  </section>

</main>

<footer class="site-footer">

  <div class="footer-shell">

    <span>
      © ${new Date().getFullYear()} ESCA7A —
      ${ru ? "Инструменты для CS2 и FACEIT." : "Tools for CS2 and FACEIT."}
    </span>

    <a
      href="${escapeHtml(SITE_CONFIG.social.github)}"
      target="_blank"
      rel="noreferrer"
    >
      GitHub ↗
    </a>

  </div>

</footer>

</body>
</html>`
}

async function buildPublications() {
  const directories = await findPublicationDirectories()

  const publications = []

  for (const directory of directories) {
    const result = await buildPublication(directory)

    if (!result) {
      continue
    }

    const published = Object.values(result.metadataByLocale).some(
      (metadata) => metadata.published !== false
    )

    if (published) {
      publications.push(result)
    }
  }

  for (const locale of LOCALES) {
    const outputDir = path.join(DIST_DIR, "publications", locale)

    await ensureDir(outputDir)

    const localePublications = publications.filter(
      (publication) =>
        publication.metadataByLocale[locale] ||
        publication.metadataByLocale[DEFAULT_LOCALE]
    )

    await fs.writeFile(
      path.join(outputDir, "index.html"),
      publicationListTemplate({
        locale,
        publications: localePublications,
      })
    )
  }

  await buildPublicationRedirect({
    publications,
  })

  await fs.writeFile(
    path.join(DIST_DIR, "publications", "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),

        basePath: BASE_PATH,

        defaultLocale: DEFAULT_LOCALE,

        supportedLocales: LOCALES,

        publications,
      },
      null,
      2
    )
  )

  return publications
}

async function buildPublicationRedirect({
  publications
}) {
  const outputDir = path.join(
    DIST_DIR,
    "publications"
  )

  await ensureDir(outputDir)

  /*
   * Общий redirect:
   *
   * /publications/
   *      ↓
   * /publications/ru-RU/
   * или
   * /publications/en-US/
   */
  const targets = Object.fromEntries(
    LOCALES.map(
      (locale) => [
        locale,
        `${BASE_PATH}/publications/${locale}/`
      ]
    )
  )

  const fallback =
    targets[DEFAULT_LOCALE] ||
    Object.values(targets)[0]

  await fs.writeFile(
    path.join(
      outputDir,
      "index.html"
    ),
    redirectTemplate({
      targets,
      fallback,
      title: "Publications"
    })
  )

  /*
   * Redirect для каждой отдельной публикации:
   *
   * /publications/grenades-and-tools/
   *      ↓
   * /publications/grenades-and-tools/ru-RU/
   *
   * При этом язык выбирается так же,
   * как на остальных страницах сайта.
   */
  for (const publication of publications) {
    const publicationDir = path.join(
      outputDir,
      publication.slug
    )

    await ensureDir(publicationDir)

    const availableLocales =
      publication.availableLocales

    const publicationTargets =
      Object.fromEntries(
        availableLocales.map(
          (locale) => [
            locale,
            `${BASE_PATH}/publications/${encodeURIComponent(
              publication.slug
            )}/${locale}/`
          ]
        )
      )

    const publicationFallback =
      publicationTargets[DEFAULT_LOCALE] ||
      publicationTargets[availableLocales[0]]

    await fs.writeFile(
      path.join(
        publicationDir,
        "index.html"
      ),
      redirectTemplate({
        targets: publicationTargets,
        fallback: publicationFallback,
        title:
          publication.metadataByLocale[
            DEFAULT_LOCALE
          ]?.title ||
          publication.metadataByLocale[
            availableLocales[0]
          ]?.title ||
          publication.slug
      })
    )
  }
}


/* -------------------------------------------------------------------------- */
/* PROJECT DOCUMENTATION                                                       */
/* -------------------------------------------------------------------------- */

async function findMarkdownFiles(directory) {
  const result = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        result.push(fullPath)
      }
    }
  }

  await walk(directory)

  return result
}

function projectMarkdownUrl(projectId, relativePath, locale) {
  const relativeDir = path.dirname(relativePath)

  if (relativeDir === ".") {
    return `${BASE_PATH}/projects/${projectId}/${locale}/`
  }

  return `${BASE_PATH}/projects/${projectId}/${relativeDir}/${locale}/`
}

function projectAssetUrl(projectId, sourceFilePath, assetPath) {
  const absoluteAssetPath = path.resolve(
    path.dirname(sourceFilePath),
    assetPath
  )

  const projectRoot = path.resolve(PROJECTS_DIR, projectId)

  const relativeAssetPath = path.relative(projectRoot, absoluteAssetPath)

  if (
    relativeAssetPath.startsWith("..") ||
    path.isAbsolute(relativeAssetPath)
  ) {
    return null
  }

  const urlPath = relativeAssetPath
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/")

  return `${BASE_PATH}/projects/${projectId}/${urlPath}`
}

function isExternalUrl(value) {
  return (
    !value ||
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  )
}

function resolveProjectMarkdownLink({ projectId, sourceFilePath, href }) {
  if (isExternalUrl(href)) {
    return href
  }

  const [pathPart, hashPart] = href.split("#", 2)

  if (!pathPart.toLowerCase().endsWith(".md")) {
    return href
  }

  const targetPath = path.resolve(path.dirname(sourceFilePath), pathPart)

  const projectRoot = path.resolve(PROJECTS_DIR, projectId)

  const relativeTarget = path.relative(projectRoot, targetPath)

  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    return href
  }

  const targetLocale = path.basename(relativeTarget).replace(/\.md$/i, "")

  if (!LOCALES.includes(targetLocale)) {
    return href
  }

  const targetDir = path.dirname(relativeTarget)

  const targetUrl =
    targetDir === "."
      ? `${BASE_PATH}/projects/${projectId}/${targetLocale}/`
      : `${BASE_PATH}/projects/${projectId}/${targetDir}/${targetLocale}/`

  return hashPart ? `${targetUrl}#${hashPart}` : targetUrl
}

function createProjectMarkdownRenderer({ projectId, sourceFilePath }) {
  const renderer = new marked.Renderer()

  renderer.link = function ({ href, title, text }) {
    const resolvedHref = resolveProjectMarkdownLink({
      projectId,
      sourceFilePath,
      href,
    })

    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ""

    return `
        <a
          href="${escapeHtml(resolvedHref)}"
          ${titleAttribute}
        >
          ${text}
        </a>
      `
  }

  renderer.image = function ({ href, title, text }) {
    let resolvedHref = href

    if (!isExternalUrl(href)) {
      resolvedHref = projectAssetUrl(projectId, sourceFilePath, href) || href
    }

    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ""

    return `
        <img
          src="${escapeHtml(resolvedHref)}"
          alt="${escapeHtml(text || "")}"
          ${titleAttribute}
        >
      `
  }

  renderer.html = function ({ text }) {
    return text.replace(
      /(\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
      (match, prefix, quote, value) => {
        if (isExternalUrl(value)) {
          return match
        }

        const resolvedValue = projectAssetUrl(projectId, sourceFilePath, value)

        if (!resolvedValue) {
          return match
        }

        return `${prefix}${quote}` + `${escapeHtml(resolvedValue)}` + `${quote}`
      }
    )
  }

  return renderer
}

function redirectTemplate({ targets, fallback, title }) {
  return `<!doctype html>
<html lang="${escapeHtml(DEFAULT_LOCALE)}">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    http-equiv="refresh"
    content="0;url=${escapeHtml(fallback)}"
  >

  <title>
    ${escapeHtml(title)} — ESCA7A
  </title>

</head>

<body>

<p>
  Redirecting…
</p>

<script>
const targets = ${JSON.stringify(targets)};
const supported = Object.keys(targets);
const stored = localStorage.getItem('site-locale');
const browser = (navigator.language || '').toLowerCase();

const locale =
  stored && supported.includes(stored)
    ? stored
    : supported.find(
        value =>
          value.toLowerCase() === browser
      )
    || supported.find(
        value =>
          value.split('-')[0] ===
          browser.split('-')[0]
      )
    || '${escapeHtml(DEFAULT_LOCALE)}';

location.replace(
  targets[locale] ||
  targets['${escapeHtml(DEFAULT_LOCALE)}'] ||
  '${escapeHtml(fallback)}'
);
</script>

</body>
</html>`
}

/* -------------------------------------------------------------------------- */
/* PROJECTS                                                                   */
/* -------------------------------------------------------------------------- */



function projectRedirectTemplate({
  project,
  targets,
  fallback,
}) {
  const projectName =
    project.meta?.[localeCode(DEFAULT_LOCALE)]?.name ||
    project.meta?.[DEFAULT_LOCALE]?.name ||
    project.id

  return `<!doctype html>
<html lang="${escapeHtml(DEFAULT_LOCALE)}">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    http-equiv="refresh"
    content="0;url=${escapeHtml(fallback)}"
  >

  <title>
    ${escapeHtml(projectName)} — ESCA7A
  </title>

</head>

<body>

<p>
  Redirecting…
</p>

<script>
const targets = ${JSON.stringify(targets)};
const supported = Object.keys(targets);

const stored = localStorage.getItem('site-locale');

const browserLanguages =
  navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

function detectLocale() {
  if (
    stored &&
    supported.includes(stored)
  ) {
    return stored;
  }

  for (const browser of browserLanguages) {
    const exact = supported.find(
      locale =>
        locale.toLowerCase() ===
        String(browser).toLowerCase()
    );

    if (exact) {
      return exact;
    }

    const language =
      String(browser).split('-')[0].toLowerCase();

    const partial = supported.find(
      locale =>
        locale.split('-')[0].toLowerCase() ===
        language
    );

    if (partial) {
      return partial;
    }
  }

  return '${escapeHtml(DEFAULT_LOCALE)}';
}

const locale = detectLocale();

location.replace(
  targets[locale] ||
  targets['${escapeHtml(DEFAULT_LOCALE)}'] ||
  '${escapeHtml(fallback)}'
);
</script>

</body>
</html>`
}

async function buildProject(project) {
  if (!project.enabled) {
    return null
  }

  const projectDir = path.join(PROJECTS_DIR, project.id)

  if (!(await fileExists(projectDir))) {
    return null
  }

  const markdownFiles = await findMarkdownFiles(projectDir)

  const pages = []

  for (const filePath of markdownFiles) {
    const relativePath = path.relative(projectDir, filePath)

    const fileName = path.basename(relativePath)

    const locale = fileName.replace(/\.md$/i, "")

    if (!LOCALES.includes(locale)) {
      continue
    }

    const source = await fs.readFile(filePath, "utf8")

    const parsed = parseFrontMatter(source)

    const renderer = createProjectMarkdownRenderer({
      projectId: project.id,
      sourceFilePath: filePath,
    })

    const html = marked.parse(parsed.content, {
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false,
      renderer,
    })

    const relativeDir = path.dirname(relativePath)

    const outputDir =
      relativeDir === "."
        ? path.join(
            DIST_DIR,
            "projects",
            project.id,
            locale
          )
        : path.join(
            DIST_DIR,
            "projects",
            project.id,
            relativeDir,
            locale
          )

    await ensureDir(outputDir)

    const templatePath = path.join(
      projectDir,
      "index.html"
    )

    const template = await readTemplate(templatePath)

    const rendered = renderTemplate(template, {
      locale,
      metadata: parsed.data,
      content: html,
    })

    await fs.writeFile(
      path.join(outputDir, "index.html"),
      rendered
    )

    pages.push({
      source: relativePath,
      locale,
      url: projectMarkdownUrl(
        project.id,
        relativePath,
        locale
      ),
    })
  }

  /*
   * Создаём входную страницу проекта.
   *
   * /projects/<project>/
   *
   * определяет язык и отправляет пользователя
   * в соответствующую локализованную документацию.
   */

  const availableLocales = [
    ...new Set(
      pages.map((page) => page.locale)
    ),
  ]

  if (availableLocales.length) {
    const targets = Object.fromEntries(
      availableLocales.map((locale) => [
        locale,
        `${BASE_PATH}/projects/${project.id}/${locale}/`,
      ])
    )

    const fallback =
      targets[DEFAULT_LOCALE] ||
      Object.values(targets)[0]

    const projectRoot =
      path.join(
        DIST_DIR,
        "projects",
        project.id
      )

    await ensureDir(projectRoot)

    await fs.writeFile(
      path.join(projectRoot, "index.html"),
      projectRedirectTemplate({
        project,
        targets,
        fallback,
      })
    )
  }

  return {
    id: project.id,
    pages,
  }
}

async function buildProjects() {
  const projects = []

  for (const project of PROJECTS) {
    const result = await buildProject(project)

    if (result) {
      projects.push(result)
    }
  }

  return projects
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  await removeDir(DIST_DIR)

  /*
   * Копируем сайт целиком.
   *
   * Поэтому:
   *
   * projects/index.html
   * projects/registry.js
   * projects/woki/index.html
   * projects/woki/config.js
   * projects/training-cs2-nades/index.html
   * projects/training-cs2-nades/config.js
   *
   * уже оказываются в dist.
   */
  await copySiteSource()

  /*
   * После копирования удаляем только Markdown
   * из готового project output.
   */
  for (const project of PROJECTS) {
    const outputDir = path.join(DIST_DIR, "projects", project.id)

    if (await fileExists(outputDir)) {
      await cleanProjectOutput(project)
    }
  }

  const projects = await buildProjects()

  const publications = await buildPublications()

  console.log(
    `Built ${projects.length} project(s) ` +
      `and ${publications.length} publication(s) ` +
      `for ${LOCALES.length} locale(s).`
  )
}

await main()
