import fs from 'node:fs/promises';
import { marked } from 'marked';
import { PROJECTS } from './projects/registry.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLICATIONS_DIR = path.join(ROOT, 'publications');
const PROJECTS_DIR = path.join(ROOT, 'projects');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_CONFIG_PATH = path.join(ROOT, 'config', 'site.config.js');

const SITE_CONFIG = (await import(`file://${SITE_CONFIG_PATH}?v=${Date.now()}`)).SITE_CONFIG;
const LOCALES = SITE_CONFIG.supportedLocales;
const DEFAULT_LOCALE = SITE_CONFIG.defaultLocale;
const BASE_PATH = SITE_CONFIG.basePath.replace(/\/$/, '');

const ARTICLE_CSS = `${BASE_PATH}/components/publication/publication.css`;

async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function copySiteSource() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (['dist', 'node_modules', '.git'].includes(entry.name)) {
      continue;
    }

    if (entry.name === 'projects') {
      continue;
    }

    if (entry.name === 'publications') {
      await fs.mkdir(path.join(DIST_DIR, 'publications'), { recursive: true });

      const publicationEntries = await fs.readdir(
        PUBLICATIONS_DIR,
        { withFileTypes: true }
      );

      for (const publicationEntry of publicationEntries) {
        if (publicationEntry.name === 'index.html') {
          await fs.copyFile(
            path.join(PUBLICATIONS_DIR, publicationEntry.name),
            path.join(DIST_DIR, 'publications', publicationEntry.name)
          );
        }
      }

      continue;
    }

    await fs.cp(
      path.join(ROOT, entry.name),
      path.join(DIST_DIR, entry.name),
      { recursive: true }
    );
  }
}

function parseFrontMatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

  if (!match) {
    return {
      data: {},
      content: source
    };
  }

  const data = {};

  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }

    data[key] = value;
  }

  return {
    data,
    content: source.slice(match[0].length)
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char])
  );
}

function slugFromDirectory(directory) {
  return path.basename(directory);
}

function localeCode(locale) {
  return locale.split('-')[0];
}

function localeLabel(locale) {
  return localeCode(locale).toUpperCase();
}

function publicationTemplate({
  locale,
  metadata,
  html,
  slug,
  availableLocales
}) {
  const title = metadata.title || slug;
  const description = metadata.description || '';

  const languageLinks = availableLocales.map(item => {
    const active = item === locale
      ? ' aria-current="page"'
      : '';

    return `<a class="publication-language${active}" href="${BASE_PATH}/publications/${encodeURIComponent(slug)}/${item}/">${localeLabel(item)}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} — ESCA7A</title>
  <link rel="stylesheet" href="${BASE_PATH}/css/style.css">
  <link rel="stylesheet" href="${ARTICLE_CSS}">
</head>
<body>
<header class="site-header publication-header">
  <div class="publication-nav">
    <a class="brand" href="${BASE_PATH}/">ESCA7A<span>.</span></a>
    <a href="${BASE_PATH}/publications/">← ${locale === DEFAULT_LOCALE ? 'Публикации' : 'Publications'}</a>
    <div class="publication-languages" aria-label="Language">${languageLinks}</div>
  </div>
</header>
<main class="publication-page section-shell">
  <article class="publication-content">
    <header class="publication-title">
      <div class="section-kicker">${locale === DEFAULT_LOCALE ? 'ПУБЛИКАЦИЯ' : 'PUBLICATION'}</div>
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p class="publication-description">${escapeHtml(description)}</p>` : ''}
      ${metadata.date ? `<time datetime="${escapeHtml(metadata.date)}">${escapeHtml(metadata.date)}</time>` : ''}
    </header>
    <div class="publication-body">${html}</div>
  </article>
</main>
<footer class="site-footer publication-footer">
  <div class="footer-shell">© ${new Date().getFullYear()} ESCA7A</div>
</footer>
</body>
</html>`;
}

async function findPublicationDirectories() {
  const entries = await fs.readdir(
    PUBLICATIONS_DIR,
    { withFileTypes: true }
  );

  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(PUBLICATIONS_DIR, entry.name));
}

async function readPublicationLocale(directory, locale) {
  const filePath = path.join(directory, `${locale}.md`);

  try {
    const source = await fs.readFile(filePath, 'utf8');
    return parseFrontMatter(source);
  } catch {
    return null;
  }
}

function publicationListTemplate({ locale, publications }) {
  const isRu = locale === DEFAULT_LOCALE;

  const title = isRu
    ? 'Публикации'
    : 'Publications';

  const description = isRu
    ? 'Статьи, заметки и разборы о Counter-Strike 2, FACEIT и соревновательной игре.'
    : 'Articles, notes and reviews about Counter-Strike 2, FACEIT and competitive gaming.';

  const cards = publications.map(item => {
    const metadata =
      item.metadataByLocale[locale] ||
      item.metadataByLocale[DEFAULT_LOCALE] ||
      {};

    return `
      <a class="publication-card" href="${BASE_PATH}/publications/${encodeURIComponent(item.slug)}/">
        <div class="publication-card-meta">
          <span>${escapeHtml(metadata.category || 'CS2')}</span>
          ${metadata.date ? `<time>${escapeHtml(metadata.date)}</time>` : ''}
        </div>

        <h2>${escapeHtml(metadata.title || item.slug)}</h2>

        ${metadata.description
          ? `<p>${escapeHtml(metadata.description)}</p>`
          : ''}

        <span class="publication-card-link">
          ${isRu ? 'Читать' : 'Read'} <b>↗</b>
        </span>
      </a>
    `;
  }).join('');

  const navigationLinks = `
    <a href="${BASE_PATH}/" data-nav="home">
      ${isRu ? 'Главная' : 'Home'}
    </a>

    ${SITE_CONFIG.navigation.showProjects
      ? `<a href="${BASE_PATH}/projects/" data-nav="projects">
          ${isRu ? 'Проекты' : 'Projects'}
        </a>`
      : ''}

    ${SITE_CONFIG.navigation.showPublications
      ? `<a href="${BASE_PATH}/publications/" data-nav="publications" aria-current="page">
          ${isRu ? 'Публикации' : 'Publications'}
        </a>`
      : ''}

    ${SITE_CONFIG.navigation.showAbout
      ? `<a href="${BASE_PATH}/about/" data-nav="about">
          ${isRu ? 'Обо мне' : 'About'}
        </a>`
      : ''}
  `;

  const languageSwitcher = SITE_CONFIG.navigation.showLanguageSwitcher
    ? `
      <label class="language-switcher">
        <span class="sr-only">
          ${isRu ? 'Язык' : 'Language'}
        </span>

        <select data-language aria-label="${isRu ? 'Язык' : 'Language'}">
          ${LOCALES.map(item => `
            <option value="${escapeHtml(item)}" ${item === locale ? 'selected' : ''}>
              ${localeLabel(item)}
            </option>
          `).join('')}
        </select>
      </label>
    `
    : '';

  const footerGithub = SITE_CONFIG.social.github;

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta
    name="description"
    content="${escapeHtml(description)}"
  >
  <title>${escapeHtml(title)} — ESCA7A</title>

  <link rel="stylesheet" href="${BASE_PATH}/css/style.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/navigation/navigation.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/publications/publications.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/footer/footer.css">
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

    <nav class="nav-links" aria-label="${isRu ? 'Основная навигация' : 'Primary'}">
      ${navigationLinks}
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
      ${isRu ? 'ПУБЛИКАЦИИ' : 'PUBLICATIONS'}
    </div>

    <h1>${escapeHtml(title)}</h1>

    <p>${escapeHtml(description)}</p>
  </section>

  <section class="publications-grid">
    ${
      cards ||
      `
        <div class="publications-empty">
          <span>${isRu ? 'ПОКА ПУСТО' : 'COMING SOON'}</span>
        </div>
      `
    }
  </section>

</main>

<footer class="site-footer">
  <div class="footer-shell">

    <span>
      © ${new Date().getFullYear()} ESCA7A —
      ${isRu
        ? 'Инструменты для CS2 и FACEIT.'
        : 'Tools for CS2 and FACEIT.'}
    </span>

    <a
      href="${escapeHtml(footerGithub)}"
      target="_blank"
      rel="noreferrer"
    >
      GitHub ↗
    </a>

  </div>
</footer>

</body>
</html>`;
}

async function buildPublication(directory) {
  const slug = slugFromDirectory(directory);

  const entries = await fs.readdir(
    directory,
    { withFileTypes: true }
  );

  const markdownFiles = entries.filter(
    entry =>
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.md')
  );

  const availableLocales = markdownFiles
    .map(file => file.name.replace(/\.md$/i, ''))
    .filter(locale => LOCALES.includes(locale));

  if (!availableLocales.length) {
    return null;
  }

  availableLocales.sort(
    (a, b) => LOCALES.indexOf(a) - LOCALES.indexOf(b)
  );

  const metadataByLocale = {};

  for (const locale of availableLocales) {
    const filePath = path.join(directory, `${locale}.md`);
    const source = await fs.readFile(filePath, 'utf8');
    const parsed = parseFrontMatter(source);

    metadataByLocale[locale] = parsed.data;

    const html = marked.parse(parsed.content, {
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false
    });

    const outputDir = path.join(
      DIST_DIR,
      'publications',
      slug,
      locale
    );

    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(
      path.join(outputDir, 'index.html'),
      publicationTemplate({
        locale,
        metadata: parsed.data,
        html,
        slug,
        availableLocales
      })
    );
  }

  const rootDir = path.join(
    DIST_DIR,
    'publications',
    slug
  );

  await fs.mkdir(rootDir, { recursive: true });

  const fallbackLocale =
    availableLocales.includes(DEFAULT_LOCALE)
      ? DEFAULT_LOCALE
      : availableLocales[0];

  const localeTargets = JSON.stringify(
    Object.fromEntries(
      availableLocales.map(locale => [
        locale,
        `${BASE_PATH}/publications/${slug}/${locale}/`
      ])
    )
  );

  await fs.writeFile(
    path.join(rootDir, 'index.html'),
    `<!doctype html><html lang="${DEFAULT_LOCALE}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${BASE_PATH}/publications/${slug}/${fallbackLocale}/"><title>${escapeHtml(metadataByLocale[fallbackLocale]?.title || slug)} — ESCA7A</title></head><body><script>const targets=${localeTargets};const supported=Object.keys(targets);const stored=localStorage.getItem('site-locale');const browser=(navigator.language||'').toLowerCase();const locale=stored&&supported.includes(stored)?stored:supported.find(x=>x.toLowerCase()===browser)||supported.find(x=>x.split('-')[0]===browser.split('-')[0])||'${fallbackLocale}';location.replace(targets[locale]||targets['${fallbackLocale}']);</script><p>Redirecting…</p></body></html>`
  );

  return {
    slug,
    availableLocales,
    metadataByLocale
  };
}

/* -------------------------------------------------------------------------- */
/* PROJECT DOCUMENTATION                                                       */
/* -------------------------------------------------------------------------- */

async function findMarkdownFiles(directory) {
  const result = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(
      currentDir,
      { withFileTypes: true }
    );

    for (const entry of entries) {
      const fullPath = path.join(
        currentDir,
        entry.name
      );

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith('.md')
      ) {
        result.push(fullPath);
      }
    }
  }

  await walk(directory);

  return result;
}

function projectMarkdownUrl(
  projectId,
  relativePath,
  locale
) {
  const relativeDir = path.dirname(relativePath);

  if (relativeDir === '.') {
    return `${BASE_PATH}/projects/${projectId}/${locale}/`;
  }

  return `${BASE_PATH}/projects/${projectId}/${relativeDir}/${locale}/`;
}

function projectDocumentDirectoryUrl(
  projectId,
  relativePath
) {
  const relativeDir = path.dirname(relativePath);

  if (relativeDir === '.') {
    return `${BASE_PATH}/projects/${projectId}/`;
  }

  return `${BASE_PATH}/projects/${projectId}/${relativeDir}/`;
}

function projectAssetUrl(
  projectId,
  sourceFilePath,
  assetPath
) {
  const sourceDirectory = path.dirname(sourceFilePath);

  const absoluteAssetPath = path.resolve(
    sourceDirectory,
    assetPath
  );

  const projectRoot = path.resolve(
    PROJECTS_DIR,
    projectId
  );

  const relativeAssetPath = path.relative(
    projectRoot,
    absoluteAssetPath
  );

  if (
    relativeAssetPath.startsWith('..') ||
    path.isAbsolute(relativeAssetPath)
  ) {
    return null;
  }

  const urlPath = relativeAssetPath
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');

  return `${BASE_PATH}/projects/${projectId}/${urlPath}`;
}

function isExternalUrl(value) {
  return (
    !value ||
    value.startsWith('#') ||
    value.startsWith('/') ||
    value.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function resolveProjectMarkdownLink({
  projectId,
  sourceFilePath,
  relativePath,
  href
}) {
  if (isExternalUrl(href)) {
    return href;
  }

  const [pathPart, hashPart] = href.split('#', 2);

  if (!pathPart.toLowerCase().endsWith('.md')) {
    return href;
  }

  const sourceDirectory = path.dirname(sourceFilePath);

  const targetPath = path.resolve(
    sourceDirectory,
    pathPart
  );

  const projectRoot = path.resolve(
    PROJECTS_DIR,
    projectId
  );

  const relativeTarget = path.relative(
    projectRoot,
    targetPath
  );

  if (
    relativeTarget.startsWith('..') ||
    path.isAbsolute(relativeTarget)
  ) {
    return href;
  }

  const targetFileName = path.basename(relativeTarget);
  const targetLocale = targetFileName.replace(
    /\.md$/i,
    ''
  );

  if (!LOCALES.includes(targetLocale)) {
    return href;
  }

  const targetRelativePath = path.dirname(
    relativeTarget
  );

  const targetUrl = targetRelativePath === '.'
    ? `${BASE_PATH}/projects/${projectId}/${targetLocale}/`
    : `${BASE_PATH}/projects/${projectId}/${targetRelativePath}/${targetLocale}/`;

  return hashPart
    ? `${targetUrl}#${hashPart}`
    : targetUrl;
}

function createProjectMarkdownRenderer({
  projectId,
  sourceFilePath
}) {
  const renderer = new marked.Renderer();

  renderer.link = function ({ href, title, text }) {
    const resolvedHref = resolveProjectMarkdownLink({
      projectId,
      sourceFilePath,
      href
    });

    const titleAttribute = title
      ? ` title="${escapeHtml(title)}"`
      : '';

    return `<a href="${escapeHtml(resolvedHref)}"${titleAttribute}>${text}</a>`;
  };

  renderer.image = function ({ href, title, text }) {
    let resolvedHref = href;

    if (!isExternalUrl(href)) {
      resolvedHref =
        projectAssetUrl(
          projectId,
          sourceFilePath,
          href
        ) || href;
    }

    const titleAttribute = title
      ? ` title="${escapeHtml(title)}"`
      : '';

    return `<img src="${escapeHtml(resolvedHref)}" alt="${escapeHtml(text || '')}"${titleAttribute}>`;
  };

  renderer.html = function ({ text }) {
    return text.replace(
      /(\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
      (match, prefix, quote, value) => {
        if (isExternalUrl(value)) {
          return match;
        }

        const resolvedValue =
          projectAssetUrl(
            projectId,
            sourceFilePath,
            value
          );

        if (!resolvedValue) {
          return match;
        }

        return `${prefix}${quote}${escapeHtml(resolvedValue)}${quote}`;
      }
    );
  };

  return renderer;
}

function projectTemplate({
  locale,
  project,
  metadata,
  html,
  navigation
}) {
  const language = localeCode(locale);

  const title =
    metadata.title ||
    project.meta?.[language]?.name ||
    project.id;

  const description =
    metadata.description ||
    project.meta?.[language]?.description ||
    '';

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} — ESCA7A</title>

  <link rel="stylesheet" href="${BASE_PATH}/css/style.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/navigation/navigation.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/footer/footer.css">
  <link rel="stylesheet" href="${BASE_PATH}/components/publications/publication.css">
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
      aria-label="${language === 'ru' ? 'Основная навигация' : 'Primary navigation'}"
    >
      ${navigation}
    </nav>

  </div>
</header>

<main class="publication-page section-shell">
  <article class="publication-content">

    <header class="publication-title">
      <div class="section-kicker">
        ${escapeHtml(project.meta?.[language]?.name || project.id)}
      </div>

      <h1>${escapeHtml(title)}</h1>

      ${description
        ? `<p class="publication-description">${escapeHtml(description)}</p>`
        : ''}
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
      ${language === 'ru'
        ? 'Инструменты для CS2 и FACEIT.'
        : 'Tools for CS2 and FACEIT.'}
    </span>
  </div>
</footer>

</body>
</html>`;
}

function projectNavigation({
  locale,
  project
}) {
  const isRu = localeCode(locale) === 'ru';

  const projectName =
    project.meta?.[localeCode(locale)]?.name ||
    project.id;

  return `
    <a href="${BASE_PATH}/" data-nav="home">
      ${isRu ? 'Главная' : 'Home'}
    </a>

    <a href="${BASE_PATH}/projects/" data-nav="projects">
      ${isRu ? 'Проекты' : 'Projects'}
    </a>

    <a href="${project.route}" data-nav="project" aria-current="page">
      ${escapeHtml(projectName)}
    </a>
  `;
}

function projectRedirectTemplate({
  projectId,
  title,
  targets,
  defaultLocale
}) {
  const localeTargets = JSON.stringify(targets);

  return `<!doctype html>
<html lang="${escapeHtml(defaultLocale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(targets[defaultLocale] || Object.values(targets)[0])}">
  <title>${escapeHtml(title)} — ESCA7A</title>
</head>
<body>
<script>
const targets = ${localeTargets};
const supported = Object.keys(targets);
const stored = localStorage.getItem('site-locale');
const browser = (navigator.language || '').toLowerCase();

const locale =
  stored && supported.includes(stored)
    ? stored
    : supported.find(x => x.toLowerCase() === browser)
    || supported.find(x => x.split('-')[0] === browser.split('-')[0])
    || '${escapeHtml(defaultLocale)}';

location.replace(
  targets[locale] ||
  targets['${escapeHtml(defaultLocale)}'] ||
  Object.values(targets)[0]
);
</script>

<p>Redirecting…</p>
</body>
</html>`;
}

async function buildProjectDirectoryRedirects({
  projectId,
  projectPages
}) {
  const directories = new Map();

  for (const page of projectPages) {
    const relativeDir = path.dirname(page.source);

    const directoryPath =
      relativeDir === '.'
        ? ''
        : relativeDir;

    if (!directories.has(directoryPath)) {
      directories.set(directoryPath, {});
    }

    directories.get(directoryPath)[page.locale] = page.url;
  }

  for (const [relativeDir, targets] of directories) {
    const outputDir = path.join(
      DIST_DIR,
      'projects',
      projectId,
      relativeDir
    );

    await fs.mkdir(outputDir, { recursive: true });

    const fallbackLocale =
      targets[DEFAULT_LOCALE]
        ? DEFAULT_LOCALE
        : Object.keys(targets)[0];

    await fs.writeFile(
      path.join(outputDir, 'index.html'),
      projectRedirectTemplate({
        projectId,
        title: projectId,
        targets,
        defaultLocale: fallbackLocale
      })
    );
  }
}

async function copyProjectAssets(project) {
  const projectDir = path.join(
    PROJECTS_DIR,
    project.id
  );

  const entries = await fs.readdir(
    projectDir,
    { withFileTypes: true }
  );

  for (const entry of entries) {
    if (entry.name === 'index.html') {
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.md')
    ) {
      continue;
    }

    if (entry.name === 'config.js') {
      continue;
    }

    await fs.cp(
      path.join(projectDir, entry.name),
      path.join(
        DIST_DIR,
        'projects',
        project.id,
        entry.name
      ),
      { recursive: true }
    );
  }
}

async function buildProject(project) {
  if (!project.enabled) {
    return null;
  }

  const projectDir = path.join(
    PROJECTS_DIR,
    project.id
  );

  try {
    await fs.access(projectDir);
  } catch {
    return null;
  }

  await copyProjectAssets(project);

  const markdownFiles =
    await findMarkdownFiles(projectDir);

  const builtPages = [];

  for (const filePath of markdownFiles) {
    const relativePath = path.relative(
      projectDir,
      filePath
    );

    const fileName = path.basename(
      relativePath
    );

    const locale = fileName.replace(
      /\.md$/i,
      ''
    );

    if (!LOCALES.includes(locale)) {
      continue;
    }

    const source =
      await fs.readFile(filePath, 'utf8');

    const parsed =
      parseFrontMatter(source);

    const renderer =
      createProjectMarkdownRenderer({
        projectId: project.id,
        sourceFilePath: filePath
      });

    const html = marked.parse(
      parsed.content,
      {
        gfm: true,
        breaks: true,
        headerIds: true,
        mangle: false,
        renderer
      }
    );

    const relativeDir =
      path.dirname(relativePath);

    const outputDir = path.join(
      DIST_DIR,
      'projects',
      project.id,
      relativeDir === '.'
        ? locale
        : relativeDir,
      relativeDir === '.'
        ? ''
        : locale
    );

    await fs.mkdir(
      outputDir,
      { recursive: true }
    );

    const navigation =
      projectNavigation({
        locale,
        project
      });

    await fs.writeFile(
      path.join(outputDir, 'index.html'),
      projectTemplate({
        locale,
        project,
        metadata: parsed.data,
        html,
        navigation
      })
    );

    builtPages.push({
      source: relativePath,
      locale,
      url: projectMarkdownUrl(
        project.id,
        relativePath,
        locale
      )
    });
  }

  if (!builtPages.length) {
    return {
      id: project.id,
      pages: []
    };
  }

  await buildProjectDirectoryRedirects({
    projectId: project.id,
    projectPages: builtPages
  });

  return {
    id: project.id,
    pages: builtPages
  };
}

async function buildProjects() {
  const projects = [];

  for (const project of PROJECTS) {
    const result = await buildProject(project);

    if (result) {
      projects.push(result);
    }
  }

  return projects;
}

async function main() {
  await removeDir(DIST_DIR);
  await copySiteSource();

  const projects = await buildProjects();

  const directories =
    await findPublicationDirectories();

  const publications = [];

  for (const directory of directories) {
    const result =
      await buildPublication(directory);

    if (
      result &&
      Object.values(result.metadataByLocale)
        .some(
          metadata =>
            metadata.published !== false
        )
    ) {
      publications.push(result);
    }
  }

  for (const locale of LOCALES) {
    const listingDir = path.join(
      DIST_DIR,
      'publications',
      locale
    );

    await fs.mkdir(
      listingDir,
      { recursive: true }
    );

    await fs.writeFile(
      path.join(listingDir, 'index.html'),
      publicationListTemplate({
        locale,
        publications:
          publications.filter(
            item =>
              item.metadataByLocale[locale] ||
              item.metadataByLocale[DEFAULT_LOCALE]
          )
      })
    );
  }

  const localeTargets = JSON.stringify(
    Object.fromEntries(
      LOCALES.map(locale => [
        locale,
        `${BASE_PATH}/publications/${locale}/`
      ])
    )
  );

  await fs.writeFile(
    path.join(
      DIST_DIR,
      'publications',
      'index.html'
    ),
    `<!doctype html><html lang="${DEFAULT_LOCALE}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${BASE_PATH}/publications/${DEFAULT_LOCALE}/"><title>Publications — ESCA7A</title></head><body><script>const targets=${localeTargets};const supported=Object.keys(targets);const stored=localStorage.getItem('site-locale');const browser=(navigator.language||'').toLowerCase();const locale=stored&&supported.includes(stored)?stored:supported.find(x=>x.toLowerCase()===browser)||supported.find(x=>x.split('-')[0]===browser.split('-')[0])||'${DEFAULT_LOCALE}';location.replace(targets[locale]||targets['${DEFAULT_LOCALE}']);</script><p>Redirecting…</p></body></html>`
  );

  const index = {
    generatedAt: new Date().toISOString(),
    basePath: BASE_PATH,
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: LOCALES,
    publications,
    projects
  };

  await fs.writeFile(
    path.join(
      DIST_DIR,
      'publications',
      'index.json'
    ),
    JSON.stringify(index, null, 2)
  );

  console.log(
    `Built ${projects.length} project(s) and ${publications.length} publication(s) for ${LOCALES.length} locale(s).`
  );
}

await main();