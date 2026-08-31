import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

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

function getPublicationDirectories(
  publicationsDirectory
) {
  if (!fs.existsSync(publicationsDirectory)) {
    return [];
  }

  return fs.readdirSync(
    publicationsDirectory,
    {
      withFileTypes: true
    }
  )
    .filter(entry =>
      entry.isDirectory()
    )
    .map(entry =>
      path.join(
        publicationsDirectory,
        entry.name
      )
    );
}

/*
 * ---------------------------------------------------------
 * PUBLICATIONS
 * ---------------------------------------------------------
 */

function getPublicationFiles(
  publicationDirectory
) {
  return fs.readdirSync(
    publicationDirectory,
    {
      withFileTypes: true
    }
  )
    .filter(entry =>
      entry.isFile() &&
      entry.name.endsWith('.md')
    )
    .map(entry =>
      path.join(
        publicationDirectory,
        entry.name
      )
    );
}

function parsePublication(filePath) {
  const source = readFile(filePath);

  const {
    data
  } = matter(source);

  return {
    locale: path.basename(
      filePath,
      '.md'
    ),

    data
  };
}

function discoverPublications(
  publicationsDirectory
) {
  const result = [];

  const directories =
    getPublicationDirectories(
      publicationsDirectory
    );

  for (const directory of directories) {
    const slug = path.basename(
      directory
    );

    const files = getPublicationFiles(
      directory
    );

    const locales = [];

    for (const filePath of files) {
      const publication =
        parsePublication(filePath);

      if (
        publication.data.published === false
      ) {
        continue;
      }

      locales.push({
        locale:
          publication.locale,

        title:
          publication.data.title ?? '',

        description:
          publication.data.description ?? '',

        date:
          publication.data.date ?? null,

        featured:
          publication.data.featured === true,

        url:
          `${slug}/${publication.locale}/`
      });
    }

    if (locales.length === 0) {
      continue;
    }

    result.push({
      slug,
      locales
    });
  }

  return result;
}

/*
 * ---------------------------------------------------------
 * LOCALIZATION
 * ---------------------------------------------------------
 */

function getPublicationLocale(
  publication,
  locale
) {
  return publication.locales.find(
    item =>
      item.locale === locale
  );
}

function createPublicationList(
  publications,
  locale
) {
  return publications
    .map(publication =>
      getPublicationLocale(
        publication,
        locale
      )
    )
    .filter(Boolean)
    .map(publication => ({
      ...publication
    }));
}

/*
 * ---------------------------------------------------------
 * BUILD
 * ---------------------------------------------------------
 */

export function buildPublicationIndex({
  publicationsDirectory,
  locales,
  buildPage,
  renderTemplate,
  siteBasePath
}) {
  const publications =
    discoverPublications(
      publicationsDirectory
    );

  let pageCount = 0;

  for (const locale of Object.keys(
    locales.available
  )) {
    const items =
      createPublicationList(
        publications,
        locale
      );

    const body =
      renderTemplate({
        locale: {
          code: locale,

          isRussian:
            locale === 'ru-RU'
        },

        site: {
          basePath:
            siteBasePath
        },

        publications: items
      });

    const outputPath =
      buildPage({
        indexPath:
          path.join(
            publicationsDirectory,
            'index.html'
          ),

        locale,

        sourceRoot:
          publicationsDirectory,

        pagePath:
          'publications',

        body,

        meta: {
          title:
            locale === 'ru-RU'
              ? 'Публикации — ESCA7A'
              : 'Publications — ESCA7A',

          description:
            locale === 'ru-RU'
              ? 'Статьи и публикации ESCA7A.'
              : 'Articles and publications by ESCA7A.'
        }
      });

    console.log(
      `  ${outputPath}`
    );

    pageCount++;
  }

  return pageCount;
}