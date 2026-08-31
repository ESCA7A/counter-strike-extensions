import { PROJECTS } from '../src/projects/registry.js';

export function buildBannerData({
  locale,
  siteBasePath
}) {
  return PROJECTS
    .filter(project =>
      project.enabled !== false &&
      project.featureFlags?.showBanner !== false
    )
    .map(project => {
      const meta =
        project.meta?.[locale];

      if (!meta) {
        return null;
      }

      return {
        id: project.id,

        title:
          meta.name ?? '',

        description:
          meta.short ?? '',

        url:
          `${siteBasePath}${project.route
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')}/${locale}/`
      };
    })
    .filter(Boolean);
}