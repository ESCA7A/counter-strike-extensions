import { PROJECTS } from '../src/projects/registry.js';

export function buildBanners({
  locale,
  siteBasePath
}) {
  return PROJECTS
    .filter(project =>
      project.enabled === true &&
      project.featureFlags?.showBanner === true
    )
    .map(project => {
      const meta =
        locale === 'ru-RU'
          ? project.meta.ru
          : project.meta.en;

      return {
        id: project.id,

        title:
          meta?.name ?? '',

        description:
          meta?.short ?? '',

        url:
          `${siteBasePath}${project.route.replace(/^\/+/, '')}`
      };
    });
}