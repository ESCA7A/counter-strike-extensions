# Counter-Strike Extensions

Personal developer site for tools and projects around competitive Counter-Strike 2 and FACEIT.

## Architecture

- `config/` — site configuration, locale and project loading.
- `components/` — independent visual sections; each major section owns its CSS.
- `projects/` — project pages and per-project configuration/feature flags.
- `assets/` — shared static assets.
- `css/` — global primitives only.
- `js/` — site runtime.

## Adding a project

1. Create `projects/<project-id>/config.js`.
2. Create the project's page under `projects/<project-id>/`.
3. Register the config in `projects/registry.js`.
4. Keep project-specific styles inside that project/component rather than changing global styles.

## Locales

Supported locales are configured in `config/site.config.js`. Automatic detection checks the browser locale, then falls back to `ru-RU`.
