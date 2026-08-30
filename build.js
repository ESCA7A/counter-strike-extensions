import fs from 'node:fs';
import path from 'node:path';

import Handlebars from 'handlebars';
import { marked } from 'marked';
import matter from 'gray-matter';

import { PROJECTS } from './projects/registry.js';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

const LOCALES = ['ru-RU', 'en-US'];

const PATHS = {
    projects: path.join(ROOT, 'projects'),
    publications: path.join(ROOT, 'publications'),
    css: path.join(ROOT, 'css'),
    components: path.join(ROOT, 'components'),
    assets: path.join(ROOT, 'assets')
};


/* =========================================================
   FILE SYSTEM
   ========================================================= */

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), {
        recursive: true
    });

    fs.writeFileSync(filePath, content);
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(source)) {
        return;
    }

    fs.cpSync(source, destination, {
        recursive: true
    });
}


/* =========================================================
   MARKDOWN
   ========================================================= */

function parseMarkdown(filePath) {
    const source = read(filePath);
    const parsed = matter(source);

    return {
        ...parsed.data,
        content: marked.parse(parsed.content)
    };
}


/* =========================================================
   HANDLEBARS
   ========================================================= */

function compileTemplate(filePath) {
    return Handlebars.compile(
        read(filePath),
        {
            noEscape: true
        }
    );
}


/* =========================================================
   PROJECTS
   ========================================================= */

function getProjectData(project, locale) {
    const meta = project.meta?.[locale];

    if (!meta) {
        return null;
    }

    return {
        id: project.id,
        type: project.type,
        name: meta.name,
        short: meta.short,
        description: meta.description,
        features: project.features?.[locale] ?? [],
        links: project.links ?? {},
        featureFlags: project.featureFlags ?? {}
    };
}

function buildProjectList(locale) {
    return PROJECTS
        .filter(project => project.enabled)
        .map(project => {
            const data = getProjectData(
                project,
                locale
            );

            if (!data) {
                return '';
            }

            return `
<article class="project-card">

    <div class="project-card-top">

        <span class="project-type">
            ${data.type}
        </span>

        <span class="project-status">
            <i></i>
            ACTIVE
        </span>

    </div>

    <div class="project-card-content">

        <h3>
            ${data.name}
        </h3>

        <p>
            ${data.short}
        </p>

        ${
            data.features.length
                ? `
        <ul>
            ${data.features
                .map(feature => `
                    <li>${feature}</li>
                `)
                .join('')}
        </ul>
        `
                : ''
        }

    </div>

    <div class="project-card-bottom">

        <span></span>

        <a href="${data.route ?? '#'}">
            Open project ↗
        </a>

    </div>

</article>
`;
        })
        .join('\n');
}

function buildProjectsIndex(locale) {
    const templatePath = path.join(
        PATHS.projects,
        'index.html'
    );

    const template = compileTemplate(
        templatePath
    );

    const content = template({
        locale,
        title: locale === 'ru-RU'
            ? 'Инструменты для CS2 и FACEIT.'
            : 'Tools for CS2 & FACEIT.',
        sectionKicker: 'PROJECTS',
        projects: buildProjectList(locale)
    });

    write(
        path.join(
            DIST,
            'projects',
            locale,
            'index.html'
        ),
        content
    );
}


/* =========================================================
   PROJECT PAGES
   ========================================================= */

function buildProject(project, locale) {
    const projectDirectory = path.join(
        PATHS.projects,
        project.id
    );

    const templatePath = path.join(
        projectDirectory,
        'index.html'
    );

    if (!fs.existsSync(templatePath)) {
        return;
    }

    const markdownPath = path.join(
        projectDirectory,
        `${locale}.md`
    );

    let data = {
        title: '',
        description: '',
        content: ''
    };

    if (fs.existsSync(markdownPath)) {
        data = parseMarkdown(markdownPath);
    }

    const config = getProjectData(
        project,
        locale
    );

    if (!config) {
        return;
    }

    const template = compileTemplate(
        templatePath
    );

    const content = template({
        locale,
        title: data.title || config.name,
        description:
            data.description || config.description,
        type: config.type,
        content: data.content
    });

    write(
        path.join(
            DIST,
            'projects',
            project.id,
            locale,
            'index.html'
        ),
        content
    );
}


/* =========================================================
   PROJECT DOCUMENTATION
   ========================================================= */

function buildProjectDocumentation(
    project,
    locale
) {
    const projectDirectory = path.join(
        PATHS.projects,
        project.id
    );

    const documentationDirectory = path.join(
        projectDirectory,
        'how-to-install'
    );

    if (!fs.existsSync(documentationDirectory)) {
        return;
    }

    const files = fs.readdirSync(
        documentationDirectory
    );

    const sourceFile = files.find(file =>
        file.toLowerCase() ===
        `${locale}.md`.toLowerCase()
    );

    if (!sourceFile) {
        return;
    }

    const sourcePath = path.join(
        documentationDirectory,
        sourceFile
    );

    const data = parseMarkdown(sourcePath);

    const templatePath = path.join(
        projectDirectory,
        'index.html'
    );

    if (!fs.existsSync(templatePath)) {
        return;
    }

    const config = getProjectData(
        project,
        locale
    );

    if (!config) {
        return;
    }

    const template = compileTemplate(
        templatePath
    );

    const content = template({
        locale,
        title: data.title || config.name,
        description:
            data.description || config.description,
        type: config.type,
        content: data.content
    });

    write(
        path.join(
            DIST,
            'projects',
            project.id,
            'how-to-install',
            locale,
            'index.html'
        ),
        content
    );
}


/* =========================================================
   PUBLICATIONS
   ========================================================= */

function buildPublication(
    directory,
    locale
) {
    const markdownPath = path.join(
        directory,
        `${locale}.md`
    );

    if (!fs.existsSync(markdownPath)) {
        return;
    }

    const templatePath = path.join(
        PATHS.publications,
        'index.html'
    );

    if (!fs.existsSync(templatePath)) {
        return;
    }

    const data = parseMarkdown(
        markdownPath
    );

    const template = compileTemplate(
        templatePath
    );

    const content = template({
        locale,
        title: data.title,
        description: data.description,
        date: data.date,
        content: data.content
    });

    const publicationName =
        path.basename(directory);

    write(
        path.join(
            DIST,
            'publications',
            publicationName,
            locale,
            'index.html'
        ),
        content
    );
}

function buildPublications() {
    if (!fs.existsSync(PATHS.publications)) {
        return;
    }

    const entries = fs.readdirSync(
        PATHS.publications,
        {
            withFileTypes: true
        }
    );

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const directory = path.join(
            PATHS.publications,
            entry.name
        );

        for (const locale of LOCALES) {
            buildPublication(
                directory,
                locale
            );
        }
    }
}


/* =========================================================
   STATIC FILES
   ========================================================= */

function copyStaticFiles() {
    copyDirectory(
        PATHS.css,
        path.join(DIST, 'css')
    );

    copyDirectory(
        PATHS.components,
        path.join(DIST, 'components')
    );

    copyDirectory(
        PATHS.assets,
        path.join(DIST, 'assets')
    );
}


/* =========================================================
   BUILD
   ========================================================= */

function cleanDist() {
    fs.rmSync(DIST, {
        recursive: true,
        force: true
    });
}

function build() {
    console.log('Cleaning dist...');
    cleanDist();

    console.log('Copying static files...');
    copyStaticFiles();

    console.log('Building projects...');

    for (const locale of LOCALES) {
        buildProjectsIndex(locale);
    }

    for (const project of PROJECTS) {
        if (!project.enabled) {
            continue;
        }

        for (const locale of LOCALES) {
            buildProject(
                project,
                locale
            );

            buildProjectDocumentation(
                project,
                locale
            );
        }
    }

    console.log('Building publications...');
    buildPublications();

    console.log('Build complete.');
}

build();