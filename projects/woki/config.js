export const WOKI_CONFIG = {
  id: 'woki',
  enabled: true,
  route: '/projects/woki/',
  type: 'browser-extension',
  featureFlags: {
    showBanner: true,
    showFeatures: true,
    showLinks: true,
    showStatus: true,
    showTechStack: true
  },
  meta: {
    ru: { name: 'WOKI', short: 'Заметки и оценки игроков FACEIT.', description: 'Браузерное расширение для Firefox и Chromium, помогающее помнить игроков в FACEIT-лобби.' },
    en: { name: 'WOKI', short: 'FACEIT player notes and ratings.', description: 'A Firefox and Chromium extension for remembering players in FACEIT lobbies.' }
  },
  features: {
    ru: ['Заметки о игроках', 'Рейтинг в лобби', 'Автоматическое обнаружение игроков'],
    en: ['Player notes', 'Lobby ratings', 'Automatic player detection']
  },
  links: {
    github: 'https://github.com/ESCA7A',
    firefox: '#',
    chromium: '#'
  }
};
