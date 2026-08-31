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
 * MARKDOWN
 * ---------------------------------------------------------
 */

function parseMarkdown(filePath) {
  const source = readFile(filePath);

  const {
    data,
    content
  } = matter(source);

  return {
    data,

    body: marked.parse(content)
  };
}

/*
 * ---------------------------------------------------------
 * PATHS
 * ---------------------------------------------------------
 */

function getLocale(filePath) {
  return path.basename(
    filePath,
    '.md'
  );
}

/*
 * ---------------------------------------------------------
 * BUILD
 * ---------------------------------------------------------
 */

export function buildMarkdown({
  sourceRoot,
  pageRoot,
  buildPage
}) {
  const files = getMarkdownFiles(
    sourceRoot
  );

  for (const filePath of files) {
    const locale = getLocale(
      filePath
    );

    const {
      data,
      body
    } = parseMarkdown(filePath);

    const outputPath = buildPage({
      indexPath: filePath,
      locale,
      sourceRoot: pageRoot,
      body,
      meta: data
    });

    console.log(
      `  ${outputPath}`
    );
  }

  return files.length;
}