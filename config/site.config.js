export const SITE_CONFIG = {
  basePath: '/counter-strike-extensions',
  defaultLocale: 'ru-RU',
  supportedLocales: ['ru-RU', 'en-US'],
  localeStorageKey: 'site-locale',
  theme: {
    primary: '#ff5500',
    primaryHover: '#ff6a1a',
    background: '#0c0c0c',
    surface: '#151515',
    surfaceRaised: '#1b1b1b',
    text: '#f5f5f5',
    textMuted: '#a7a7a7',
    border: '#2b2b2b',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif'
  },
  social: {
    github: 'https://github.com/ESCA7A',
    faceit: 'https://www.faceit.com/'
  },
  navigation: {
    showProjects: true,
    showAbout: true,
    showPrivacy: true,
    showLanguageSwitcher: true
  }
};

export const I18N = {
  'ru-RU': {
    nav: { home: 'Главная', projects: 'Проекты', about: 'Обо мне', privacy: 'Политика' },
    hero: {
      eyebrow: 'COUNTER-STRIKE × FACEIT',
      title: 'Инструменты для соревновательной игры.',
      text: 'Создаю небольшие продукты, расширения и сервисы для игроков CS2 и экосистемы FACEIT.',
      cta: 'Смотреть проекты'
    },
    about: {
      eyebrow: 'ОБО МНЕ',
      title: 'Разработчик в экосистеме competitive CS.',
      text: 'Экспериментирую с инструментами, автоматизацией и интерфейсами, которые делают игру удобнее и помогают игрокам развиваться.'
    },
    projects: {
      eyebrow: 'ПРОЕКТЫ',
      title: 'То, что уже создано.',
      text: 'Проекты развиваются независимо и постепенно объединяются в одну экосистему.'
    },
    footer: { text: 'Инструменты для CS2 и FACEIT.', github: 'GitHub' },
    common: { open: 'Открыть', previous: 'Предыдущий', next: 'Следующий', language: 'Язык' }
  },
  'en-US': {
    nav: { home: 'Home', projects: 'Projects', about: 'About', privacy: 'Privacy' },
    hero: {
      eyebrow: 'COUNTER-STRIKE × FACEIT',
      title: 'Tools for competitive play.',
      text: 'I build small products, extensions and utilities for CS2 players and the FACEIT ecosystem.',
      cta: 'View projects'
    },
    about: {
      eyebrow: 'ABOUT',
      title: 'A developer in the competitive CS ecosystem.',
      text: 'I experiment with tools, automation and interfaces that make competitive play more useful and help players improve.'
    },
    projects: {
      eyebrow: 'PROJECTS',
      title: 'What I have built.',
      text: 'Projects evolve independently while gradually becoming one ecosystem.'
    },
    footer: { text: 'Tools for CS2 and FACEIT.', github: 'GitHub' },
    common: { open: 'Open', previous: 'Previous', next: 'Next', language: 'Language' }
  }
};
