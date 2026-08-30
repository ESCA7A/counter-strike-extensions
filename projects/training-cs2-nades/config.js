export const NADES_CONFIG = {
  id: 'training-cs2-nades',
  enabled: true,
  route: '/projects/training-cs2-nades/',
  type: 'learning-library',
  featureFlags: {
    showBanner: true,
    showFeatures: true,
    showLinks: true,
    showStatus: true,
    showTechStack: false
  },
  meta: {
    ru: { name: 'CS2 Nades', short: 'Библиотека для изучения гранат.', description: 'Практический ресурс для изучения гранат, раскидок и тренировочных материалов для CS2.' },
    en: { name: 'CS2 Nades', short: 'A CS2 grenade learning library.', description: 'A practical resource for learning grenades, lineups and training material for CS2.' }
  },
  features: {
    ru: ['Структурированные раскидки', 'Материалы для тренировки', 'Фокус на соревновательной игре'],
    en: ['Structured lineups', 'Training material', 'Competitive focus']
  },
  links: {
    github: 'https://github.com/ESCA7A',
    website: '#'
  }
};
