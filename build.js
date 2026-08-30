import fs from 'node:fs';
import path from 'node:path';

import Handlebars from 'handlebars';
import { marked } from 'marked';
import matter from 'gray-matter';

const ROOT = process.cwd();

const LOCALES = ['ru-RU', 'en-US'];

const PATHS = {
    projects: path.join(ROOT, 'projects'),
    publications: path.join(ROOT, 'publications')
};

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), {
        recursive: true
    });

    fs.writeFileSync(filePath, content);
}

function compileTemplate(filePath) {
    const source = read(filePath);

    return Handlebars.compile(source, {
        noEscape: true
    });
}

function parseMarkdown(filePath) {
    const source = read(filePath);
    const parsed = matter(source);

    return {
        ...parsed.data,
        content: marked.parse(parsed.content)
    };
}

function getMarkdownFile(directory, locale) {
    const filePath = path.join(
        directory,
        `${locale}.md`
    );

    if (!fs.existsSync(filePath)) {
        return null;
    }

    return filePath;
}

function buildPublication(directory, locale) {
    const markdownPath = getMarkdownFile(
        directory,
        locale
    );

    if (!markdownPath) {
        return;
    }

    const templatePath = path.join(
        ROOT,
        'publications',
        'index.html'
    );

    const template = compileTemplate(templatePath);
    const data = parseMarkdown(markdownPath);

    const output = template({
        locale,
        title: data.title,
        description: data.description,
        date: data.date,
        content: data.content
    });

    const outputDirectory = path.join(
        directory,
        locale
    );

    write(
        path.join(outputDirectory, 'index.html'),
        output
    );
}

function buildProject(directory, locale) {
    const markdownPath = getMarkdownFile(
        directory,
        locale
    );

    if (!markdownPath) {
        return;
    }

    const templatePath = path.join(
        directory,
        'index.html'
    );

    if (!fs.existsSync(templatePath)) {
        return;
    }

    const template = compileTemplate(templatePath);
    const data = parseMarkdown(markdownPath);

    const output = template({
        locale,
        title: data.title,
        description: data.description,
        type: data.type ?? 'PROJECT',
        content: data.content
    });

    const outputDirectory = path.join(
        directory,
        locale
    );

    write(
        path.join(outputDirectory, 'index.html'),
        output
    );
}

function buildDirectory(directory, builder) {
    if (!fs.existsSync(directory)) {
        return;
    }

    const entries = fs.readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const directoryPath = path.join(
            directory,
            entry.name
        );

        builder(directoryPath, 'ru-RU');
        builder(directoryPath, 'en-US');
    }
}

function build() {
    buildDirectory(
        PATHS.publications,
        buildPublication
    );

    buildDirectory(
        PATHS.projects,
        buildProject
    );

    console.log('Build complete.');
}

build();