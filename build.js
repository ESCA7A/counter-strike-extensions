import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';

import { buildMarkdown } from './build/markdown.js';
import { buildPublicationIndex } from './build/publicationBuilder.js';
import { buildBanners } from './build/bannerBuilder.js';

import locales from './src/config/locales.js';
import menu from './src/config/menu.js';
import footer from './src/config/footer.js';
import home from './src/config/home.js';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const TEMPLATES_DIR = path.join(SRC_DIR, 'templates');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const PROJECTS_DIR = path.join(SRC_DIR, 'projects');
const PUBLICATIONS_DIR = path.join(SRC_DIR, 'publications');
const DIST_DIR = path.join(ROOT, 'dist');
const CSS_DIR = path.join(SRC_DIR, 'css');
const HEADER_DIR = path.join(TEMPLATES_DIR, 'header');
const LOCALE_SWITCHER_FILE = path.join(HEADER_DIR, 'localeSwitcher.js');
const BANNER_FILE = path.join(TEMPLATES_DIR, 'home', 'banner.js');

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

function copyDirectory(sourceDirectory, targetDirectory) {
  if (!fs.existsSync(sourceDirectory)) {
    return;
  }

  fs.cpSync(
    sourceDirectory,
    targetDirectory,
    {
      recursive: true
    }
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

const baseTemplate = Handlebars.compile(loadTemplate('layouts/base.hbs'));

const homeTemplate = Handlebars.compile(loadTemplate('home/index.hbs'));

const publicationsTemplate = Handlebars.compile(loadTemplate('publications/index.hbs'));

const bannerTemplate = Handlebars.compile(loadTemplate('home/banner.hbs'));

Handlebars.registerPartial('header', loadTemplate('header/header.hbs'));

Handlebars.registerPartial('footer', loadTemplate('footer/footer.hbs'));

Handlebars.registerPartial('menu', loadTemplate('menu/menu.hbs'));

Handlebars.registerPartial('banner', loadTemplate('home/banner.hbs'));

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

function createLocalization(
  activeLocale,
  currentPath
) {
  return {
    languageLabel:
      activeLocale === 'ru-RU'
        ? 'Язык'
        : 'Language',

    available: getLocales().map(locale => ({
      ...locale,

      active:
        locale.code === activeLocale,

      url:
        createPageUrl(
          currentPath,
          locale.code
        )
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

    url: createPageUrl(
      item.path,
      activeLocale
    ),

    active:
      currentPath === item.path
  }));
}

function createPageUrl(pagePath, locale) {
  if (
    pagePath === '' ||
    pagePath === 'home'
  ) {
    if (locale === locales.default) {
      return SITE_BASE_PATH;
    }

    return `${SITE_BASE_PATH}${locale}/`;
  }

  return `${SITE_BASE_PATH}${pagePath}/${locale}/`;
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

    homeUrl:
      createPageUrl(
        'home',
        activeLocale
      ),

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
 * OUTPUT PATH
 * ---------------------------------------------------------
 */

function getOutputDirectory(
  pagePath,
  locale
) {
  if (pagePath === 'home') {
    if (locale === locales.default) {
      return DIST_DIR;
    }

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

function createPageData({
  locale,
  pagePath,
  body,
  meta = {}
}) {
  const menuPath =
    pagePath === 'home'
      ? ''
      : pagePath.split(path.sep)[0] || '';

  const pageBanners =
    pagePath === 'home'
      ? buildBanners({
          locale,
          siteBasePath: SITE_BASE_PATH
        })
      : [];

  const pageHome =
    pagePath === 'home'
      ? homeTemplate({
          home: home[locale],

          banners: pageBanners,

          banner:
            bannerTemplate({
              home: home[locale],
              banners: pageBanners
            })
        })
      : null;

  return {
    locale: {
      code: locale,
      label: locales.available[locale].label
    },

    site: {
      basePath: SITE_BASE_PATH
    },

    meta: {
      title:
        meta.title ??
        'ESCA7A — Counter-Strike Developer',

      description:
        meta.description ??
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

    localization: createLocalization(
      locale,
      pagePath
    ),

    footer: createFooter(locale),

    home: home[locale],

    body:
      pageHome ?? body
  };
}

function buildPage({
  indexPath,
  locale,
  sourceRoot,
  pagePath: explicitPagePath,
  body: explicitBody,
  meta
}) {
  const source = readFile(indexPath);

  const body =
    explicitBody ??
    extractBody(source);

  const pagePath =
    explicitPagePath ??
    getPagePath(
      indexPath,
      sourceRoot
    );

  const data = createPageData({
    locale,
    pagePath,
    body,
    meta
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
 * ASSETS
 * ---------------------------------------------------------
 */

function buildAssets() {
  copyDirectory(
    CSS_DIR,
    path.join(DIST_DIR, 'css')
  );

  writeFile(
    path.join(
      DIST_DIR,
      'js',
      'localeSwitcher.js',
      'banner.js'
    ),
    readFile(LOCALE_SWITCHER_FILE)
  );
}

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
  console.log('Building site...');

  cleanDist();
  buildAssets();

  let pageCount = 0;

  pageCount += buildSource(PAGES_DIR);
  pageCount += buildSource(PROJECTS_DIR);

  const publicationIndexCount =
    buildPublicationIndex({
      publicationsDirectory:
        PUBLICATIONS_DIR,

      locales,

      buildPage,

      renderTemplate:
        publicationsTemplate,

      siteBasePath:
        SITE_BASE_PATH
    });

  pageCount += publicationIndexCount;

  const markdownCount = buildMarkdown({
    sourceRoot: PUBLICATIONS_DIR,
    pageRoot: SRC_DIR,
    buildPage
  });

  pageCount += markdownCount;

  console.log(
    `Built ${pageCount} page(s).`
  );
}

build();