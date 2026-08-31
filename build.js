import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';

import locales from './src/config/locales.js';
import menu from './src/config/menu.js';
import footer from './src/config/footer.js';

const ROOT = process.cwd();

const SRC_DIR = path.join(ROOT, 'src');
const TEMPLATES_DIR = path.join(SRC_DIR, 'templates');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const PROJECTS_DIR = path.join(SRC_DIR, 'projects');

const DIST_DIR = path.join(ROOT, 'dist');

/*
 * ---------------------------------------------------------
 * SITE
 * ---------------------------------------------------------
 */

const SITE_BASE_PATH = '/counter-strike-extensions/';

/*
 * ---------------------------------------------------------
 * FILESYSTEM
 * ---------------------------------------------------------
 */

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {
    recursive: true
  });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));

  fs.writeFileSync(
    filePath,
    content,
    'utf8'
  );
}

/*
 * ---------------------------------------------------------
 * HANDLEBARS
 * ---------------------------------------------------------
 */

function loadTemplate(name) {
  const filePath = path.join(
    TEMPLATES_DIR,
    name
  );

  return readFile(filePath);
}

const baseTemplate = Handlebars.compile(
  loadTemplate('layouts/base.hbs')
);

Handlebars.registerPartial(
  'header',
  loadTemplate('header/header.hbs')
);

Handlebars.registerPartial(
  'footer',
  loadTemplate('footer/footer.hbs')
);

Handlebars.registerPartial(
  'menu',
  loadTemplate('menu/menu.hbs')
);

/*
 * ---------------------------------------------------------
 * LOCALIZATION
 * ---------------------------------------------------------
 */

function getLocales() {
  return Object.entries(
    locales.available
  ).map(([code, config]) => ({
    code,
    label: config.label
  }));
}

function createLocalization(activeLocale) {
  return {
    languageLabel:
      activeLocale === 'ru-RU'
        ? 'Язык'
        : 'Language',

    available: getLocales().map(locale => ({
      ...locale,

      active:
        locale.code === activeLocale
    }))
  };
}

/*
 * ---------------------------------------------------------
 * NAVIGATION
 * ---------------------------------------------------------
 */

function createMenu(activeLocale, currentPath) {
  return Object.values(menu).map(item => ({
    label: item.label[activeLocale],

    url: createMenuUrl(
      item.path,
      activeLocale
    ),

    active:
      currentPath === item.path
  }));
}

function createMenuUrl(menuPath, locale) {
  return `${SITE_BASE_PATH}${menuPath}/${locale}/`;
}

function createNavigation(
  activeLocale,
  currentPath
) {
  const github = footer.links?.github;

  return {
    menuLabel:
      activeLocale === 'ru-RU'
        ? 'Основная навигация'
        : 'Main navigation',

    menu: createMenu(
      activeLocale,
      currentPath
    ),

    github: github
      ? {
          label:
            github.label[activeLocale],

          url: github.url
        }
      : null
  };
}

/*
 * ---------------------------------------------------------
 * FOOTER
 * ---------------------------------------------------------
 */

function createFooter(activeLocale) {
  return {
    copyright:
      footer.copyright[activeLocale],

    links: Object.values(
      footer.links ?? {}
    ).map(link => ({
      label:
        link.label[activeLocale],

      url: link.url
    }))
  };
}

/*
 * ---------------------------------------------------------
 * PATHS
 * ---------------------------------------------------------
 */

function getLocaleDirectories() {
  return new Set(
    Object.keys(locales.available)
  );
}

function isLocaleDirectory(name) {
  return getLocaleDirectories().has(name);
}

/*
 * ---------------------------------------------------------
 * PAGE DISCOVERY
 * ---------------------------------------------------------
 *
 * We search recursively for:
 *
 *   .../<locale>/index.html
 *
 * Examples:
 *
 *   src/pages/home/ru-RU/index.html
 *   src/pages/about/ru-RU/index.html
 *   src/projects/woki/ru-RU/index.html
 *
 */

function findPages(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const result = [];

  function walk(currentDirectory) {
    for (const entry of fs.readdirSync(
      currentDirectory,
      {
        withFileTypes: true
      }
    )) {
      const fullPath = path.join(
        currentDirectory,
        entry.name
      );

      if (!entry.isDirectory()) {
        continue;
      }

      if (isLocaleDirectory(entry.name)) {
        const indexPath = path.join(
          fullPath,
          'index.html'
        );

        if (fs.existsSync(indexPath)) {
          result.push({
            indexPath,

            locale: entry.name,

            localeDirectory: fullPath
          });
        }
      }

      walk(fullPath);
    }
  }

  walk(directory);

  return result;
}

/*
 * ---------------------------------------------------------
 * PAGE PATH
 * ---------------------------------------------------------
 */

function getPagePath(
  indexPath,
  sourceRoot
) {
  return path.relative(
    sourceRoot,

    path.dirname(
      path.dirname(indexPath)
    )
  );
}

/*
 * ---------------------------------------------------------
 * CONTENT
 * ---------------------------------------------------------
 */

function extractBody(source) {
  const bodyMatch = source.match(
    /<body[^>]*>([\s\S]*?)<\/body>/i
  );

  if (bodyMatch) {
    return bodyMatch[1].trim();
  }

  return source.trim();
}

/*
 * ---------------------------------------------------------
 * PAGE DATA
 * ---------------------------------------------------------
 */

function createPageData({
  locale,
  pagePath,
  body
}) {
  const menuPath =
    pagePath === 'home'
      ? ''
      : pagePath.split(path.sep)[0] || '';

  return {
    locale: {
      code: locale,

      label:
        locales.available[locale].label
    },

    site: {
      basePath: SITE_BASE_PATH
    },

    meta: {
      title:
        'ESCA7A — Counter-Strike Developer',

      description:
        'ESCA7A — developer of Counter-Strike and FACEIT tools.'
    },

    assets: {
      css: `${SITE_BASE_PATH}css`,
      js: `${SITE_BASE_PATH}js`
    },

    navigation: createNavigation(
      locale,
      menuPath
    ),

    localization:
      createLocalization(locale),

    footer:
      createFooter(locale),

    body
  };
}

/*
 * ---------------------------------------------------------
 * OUTPUT PATH
 * ---------------------------------------------------------
 */

function getOutputDirectory(
  pagePath,
  locale
) {
  if (pagePath === 'home') {
    return path.join(
      DIST_DIR,
      locale
    );
  }

  return path.join(
    DIST_DIR,
    pagePath,
    locale
  );
}

/*
 * ---------------------------------------------------------
 * BUILD PAGE
 * ---------------------------------------------------------
 */

function buildPage({
  indexPath,
  locale,
  sourceRoot
}) {
  const source = readFile(indexPath);

  const body = extractBody(source);

  const pagePath = getPagePath(
    indexPath,
    sourceRoot
  );

  const data = createPageData({
    locale,
    pagePath,
    body
  });

  const html = baseTemplate(data);

  const outputDirectory =
    getOutputDirectory(
      pagePath,
      locale
    );

  const outputPath = path.join(
    outputDirectory,
    'index.html'
  );

  writeFile(
    outputPath,
    html
  );

  return path.relative(
    ROOT,
    outputPath
  );
}

/*
 * ---------------------------------------------------------
 * BUILD SOURCE
 * ---------------------------------------------------------
 */

function buildSource(sourceRoot) {
  const pages = findPages(
    sourceRoot
  );

  for (const page of pages) {
    const outputPath = buildPage({
      ...page,
      sourceRoot
    });

    console.log(
      `  ${outputPath}`
    );
  }

  return pages.length;
}

/*
 * ---------------------------------------------------------
 * CLEAN
 * ---------------------------------------------------------
 */

function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(
      DIST_DIR,
      {
        recursive: true,
        force: true
      }
    );
  }

  ensureDir(DIST_DIR);
}

/*
 * ---------------------------------------------------------
 * BUILD
 * ---------------------------------------------------------
 */

function build() {
  console.log(
    'Building site...'
  );

  cleanDist();

  let pageCount = 0;

  pageCount += buildSource(
    PAGES_DIR
  );

  pageCount += buildSource(
    PROJECTS_DIR
  );

  console.log(
    `Built ${pageCount} page(s).`
  );
}

build();
