import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

/*
 * ---------------------------------------------------------
 * FILESYSTEM
 * ---------------------------------------------------------
 */

function readFile(filePath) {
  return fs.readFileSync(
    filePath,
    'utf8'
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(
    dirPath,
    {
      recursive: true
    }
  );
}

function copyDirectory(
  sourceDirectory,
  targetDirectory
) {
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

function getMarkdownFiles(directory) {
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

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        entry.name.endsWith('.md')
      ) {
        result.push(fullPath);
      }
    }
  }

  walk(directory);

  return result;
}

/*
 * ---------------------------------------------------------
 * PATHS
 * ---------------------------------------------------------
 */

function getSourceSection(
  sourceRoot
) {
  return path.basename(
    sourceRoot
  );
}

function getMarkdownRelativePath(
  filePath,
  sourceRoot
) {
  return path.relative(
    sourceRoot,
    filePath
  );
}

function getMarkdownDirectory(
  filePath,
  sourceRoot
) {
  const relativePath =
    getMarkdownRelativePath(
      filePath,
      sourceRoot
    );

  return path.dirname(
    relativePath
  );
}

function getLocale(filePath) {
  return path.basename(
    filePath,
    '.md'
  );
}

function getMarkdownName(filePath) {
  return path.basename(
    filePath,
    '.md'
  );
}

function getMarkdownEntity(
  filePath,
  sourceRoot
) {
  const relativePath =
    getMarkdownRelativePath(
      filePath,
      sourceRoot
    );

  const directory =
    path.dirname(
      relativePath
    );

  const parts =
    directory === '.'
      ? []
      : directory
          .split(path.sep)
          .filter(Boolean);

  return parts[0] ?? null;
}

/*
 * ---------------------------------------------------------
 * ROUTING
 * ---------------------------------------------------------
 *
 * Generic Markdown routing:
 *
 * section/
 *   entity/
 *     locale.md
 *
 * becomes:
 *
 * /section/entity/
 *
 * Nested Markdown:
 *
 * section/
 *   entity/
 *     page/
 *       locale.md
 *
 * becomes:
 *
 * /section/entity/page/locale/
 *
 * The root Markdown file of an entity intentionally does
 * not contain the locale in its URL. This allows entity
 * landing pages such as:
 *
 * /projects/training-cs2-nades/
 *
 */

function getMarkdownRoute({
  filePath,
  sourceRoot
}) {
  const section =
    getSourceSection(
      sourceRoot
    );

  const relativePath =
    getMarkdownRelativePath(
      filePath,
      sourceRoot
    );

  const directory =
    path.dirname(
      relativePath
    );

  const locale =
    getLocale(filePath);

  const parts =
    directory === '.'
      ? []
      : directory
          .split(path.sep)
          .filter(Boolean);

  if (parts.length === 0) {
    return {
      section,
      entity: null,
      path: path.posix.join(
        section,
        locale
      ),
      locale
    };
  }

  return {
    section,
    entity: parts[0],
    path: path.posix.join(
      section,
      ...parts,
      locale
    ),
    locale
  };
}

/*
 * ---------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------
 */

function getOutputDirectory(
  route,
  distDirectory
) {
  return path.join(
    distDirectory,
    ...route.path.split('/')
  );
}

function getOutputPath(
  route,
  distDirectory
) {
  return path.join(
    getOutputDirectory(
      route,
      distDirectory
    ),
    'index.html'
  );
}

/*
 * ---------------------------------------------------------
 * PUBLIC URL
 * ---------------------------------------------------------
 */

function createPublicUrl(
  siteBasePath,
  route
) {
  return `${siteBasePath}${route.path}/`;
}

/*
 * ---------------------------------------------------------
 * MARKDOWN LINKS
 * ---------------------------------------------------------
 *
 * Relative links inside Markdown are resolved against the
 * Markdown source file, then converted into generated site
 * URLs.
 *
 * Images are resolved to the corresponding copied asset.
 */

function isExternalUrl(url) {
  if (!url) {
    return true;
  }

  return (
    url.startsWith('#') ||
    url.startsWith('/') ||
    url.startsWith('//') ||
    /^[a-z][a-z\d+\-.]*:/i.test(url)
  );
}

function splitUrlSuffix(url) {
  const match = url.match(
    /^([^?#]*)(.*)$/
  );

  if (!match) {
    return {
      pathname: url,
      suffix: ''
    };
  }

  return {
    pathname: match[1],
    suffix: match[2]
  };
}

function normalizeRelativePath(
  filePath
) {
  return filePath
    .split(path.sep)
    .join('/');
}

function getAssetUrl({
  sourceFile,
  sourceRoot,
  pathname,
  siteBasePath
}) {
  const markdownDirectory =
    path.dirname(sourceFile);

  const assetPath =
    path.resolve(
      markdownDirectory,
      pathname
    );

  const sourceRootResolved =
    path.resolve(
      sourceRoot
    );

  const relativeAssetPath =
    path.relative(
      sourceRootResolved,
      assetPath
    );

  if (
    relativeAssetPath.startsWith('..') ||
    path.isAbsolute(relativeAssetPath)
  ) {
    return pathname;
  }

  return `${siteBasePath}${getSourceSection(
    sourceRoot
  )}/${normalizeRelativePath(
    relativeAssetPath
  )}`;
}

function getMarkdownRouteFromTarget({
  sourceFile,
  sourceRoot,
  targetPath
}) {
  const markdownDirectory =
    path.dirname(sourceFile);

  const targetFile =
    path.resolve(
      markdownDirectory,
      targetPath
    );

  const sourceRootResolved =
    path.resolve(
      sourceRoot
    );

  const relativeTarget =
    path.relative(
      sourceRootResolved,
      targetFile
    );

  if (
    relativeTarget.startsWith('..') ||
    path.isAbsolute(relativeTarget)
  ) {
    return null;
  }

  if (!relativeTarget.endsWith('.md')) {
    return null;
  }

  return getMarkdownRoute({
    filePath:
      targetFile,

    sourceRoot
  });
}

function createMarkdownRenderer({
  sourceFile,
  sourceRoot,
  siteBasePath
}) {
  const renderer =
    new marked.Renderer();

  renderer.link = function({
    href,
    title,
    tokens
  }) {
    const {
      pathname,
      suffix
    } = splitUrlSuffix(
      href
    );

    let resolvedHref =
      href;

    if (
      !isExternalUrl(href) &&
      pathname.endsWith('.md')
    ) {
      const route =
        getMarkdownRouteFromTarget({
          sourceFile,
          sourceRoot,
          targetPath: pathname
        });

      if (route) {
        resolvedHref = `${siteBasePath}${route.path}/${suffix}`;
      }
    }

    const text =
      this.parser.parseInline(
        tokens
      );

    const titleAttribute =
      title
        ? ` title="${title}"`
        : '';

    return `<a href="${resolvedHref}"${titleAttribute}>${text}</a>`;
  };

  renderer.image = function({
    href,
    title,
    text
  }) {
    const {
      pathname,
      suffix
    } = splitUrlSuffix(
      href
    );

    let resolvedHref =
      href;

    if (!isExternalUrl(href)) {
      resolvedHref =
        getAssetUrl({
          sourceFile,
          sourceRoot,
          pathname,
          siteBasePath
        }) + suffix;
    }

    const titleAttribute =
      title
        ? ` title="${title}"`
        : '';

    return `<img src="${resolvedHref}" alt="${text}"${titleAttribute}>`;
  };

  return renderer;
}

/*
 * ---------------------------------------------------------
 * MARKDOWN
 * ---------------------------------------------------------
 */

function collectMarkdownEntities({
  files,
  sourceRoot,
  siteBasePath
}) {
  const entities = new Map();

  for (const filePath of files) {
    const entity =
      getMarkdownEntity(
        filePath,
        sourceRoot
      );

    if (!entity) {
      continue;
    }

    const {
      data
    } = parseMarkdown({
      filePath,
      sourceRoot,
      siteBasePath
    });

    const route =
      getMarkdownRoute({
        filePath,
        sourceRoot
      });

    if (!entities.has(entity)) {
      entities.set(
        entity,
        {
          name: entity,
          locales: {}
        }
      );
    }

    entities.get(entity).locales[route.locale] = {
      ...data,

      url:
        `${siteBasePath}${route.section}/${entity}/${route.locale}/`
    };
  }

  return [...entities.values()];
}

function parseMarkdown({
  filePath,
  sourceRoot,
  siteBasePath
}) {
  const source =
    readFile(filePath);

  const {
    data,
    content
  } = matter(source);

  const renderer =
    createMarkdownRenderer({
      sourceFile:
        filePath,

      sourceRoot,

      siteBasePath
    });

  const html =
    marked.parse(
      content,
      {
        renderer
      }
    );

  return {
    data,

    body: `
      <article class="publication-page">
        <div class="publication-content">
          <div class="publication-body">
            ${html}
          </div>
        </div>
      </article>
    `
  };
}

/*
 * ---------------------------------------------------------
 * MARKDOWN ASSETS
 * ---------------------------------------------------------
 *
 * Every Markdown source tree can contain its own assets.
 *
 * Example:
 *
 * src/projects/training-cs2-nades/src/
 *
 * becomes:
 *
 * dist/projects/training-cs2-nades/src/
 */

function copyMarkdownAssets({
  sourceRoot,
  distDirectory
}) {
  const section =
    getSourceSection(
      sourceRoot
    );

  const entities =
    fs.readdirSync(
      sourceRoot,
      {
        withFileTypes: true
      }
    )
    .filter(entry =>
      entry.isDirectory()
    );

  for (const entity of entities) {
    const sourceEntityDirectory =
      path.join(
        sourceRoot,
        entity.name
      );

    const entries =
      fs.readdirSync(
        sourceEntityDirectory,
        {
          withFileTypes: true
        }
      );

    for (const entry of entries) {
      if (
        entry.name === 'src' &&
        entry.isDirectory()
      ) {
        const sourceAssets =
          path.join(
            sourceEntityDirectory,
            entry.name
          );

        const targetAssets =
          path.join(
            distDirectory,
            section,
            entity.name,
            entry.name
          );

        ensureDir(
          targetAssets
        );

        copyDirectory(
          sourceAssets,
          targetAssets
        );
      }
    }
  }
}

/*
 * ---------------------------------------------------------
 * BUILD
 * ---------------------------------------------------------
 */

function buildMarkdownSource({
  sourceRoot,
  distDirectory,
  siteBasePath,
  buildPage,
  locales,
  renderIndexTemplate
}) {
  const files =
    getMarkdownFiles(
      sourceRoot
    );

  if (files.length === 0) {
    return 0;
  }

  copyMarkdownAssets({
    sourceRoot,
    distDirectory
  });

  const entities =
    collectMarkdownEntities({
      files,
      sourceRoot,
      siteBasePath
    });

  const section =
    getSourceSection(
      sourceRoot
    );

  let pageCount = 0;

  for (const locale of Object.keys(
    locales.available
  )) {
    const outputPath =
      buildMarkdownIndex({
        entities,

        locale,

        section,

        sourceRoot,

        renderTemplate:
          renderIndexTemplate,

        buildPage,

        siteBasePath
      });

    console.log(
      `  ${outputPath}`
    );

    pageCount++;
  }

  for (const filePath of files) {
    const route =
      getMarkdownRoute({
        filePath,
        sourceRoot
      });

    const {
      data,
      body
    } = parseMarkdown({
      filePath,
      sourceRoot,
      siteBasePath
    });

    const outputPath =
      buildPage({
        indexPath:
          filePath,

        locale:
          route.locale,

        sourceRoot,

        pagePath:
          route.path,

        body,

        meta:
          data
      });

    console.log(
      `  ${outputPath}`
    );

    pageCount++;
  }

  return pageCount;
}

function buildMarkdownIndex({
  entities,
  locale,
  section,
  sourceRoot,
  renderTemplate,
  buildPage,
  siteBasePath
}) {
  const items =
    entities
      .filter(entity =>
        entity.locales[locale]
      )
      .map(entity => ({
        ...entity.locales[locale],

        name:
          entity.name,

        url:
          `${siteBasePath}${section}/${entity.name}/${locale}/`
      }));

  const body =
    renderTemplate({
      locale,
      items
    });

  return buildPage({
    indexPath:
      null,

    locale,

    sourceRoot,

    pagePath:
      path.posix.join(
        section,
        locale
      ),

    body,

    meta: {}
  });
}

export function buildMarkdown({
  sources,
  distDirectory,
  siteBasePath,
  buildPage,
  locales
}) {
  let pageCount = 0;

  for (const source of sources) {
    pageCount +=
      buildMarkdownSource({
        sourceRoot:
          source.sourceRoot,

        distDirectory,

        siteBasePath,

        buildPage,

        locales,

        renderIndexTemplate:
          source.renderIndexTemplate
      });
  }

  return pageCount;
}