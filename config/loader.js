import { SITE_CONFIG, I18N } from './site.config.js';
import { PROJECTS } from '../projects/registry.js';

export function getPath(path = '/') {
  const base = SITE_CONFIG.basePath.replace(/\/$/, '');
  const clean = `/${String(path).replace(/^\//, '')}`;
  return `${base}${clean}` || '/';
}

export function detectLocale() {
  const stored = localStorage.getItem(SITE_CONFIG.localeStorageKey);
  if (stored && SITE_CONFIG.supportedLocales.includes(stored)) return stored;

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const exact = SITE_CONFIG.supportedLocales.find(locale => locale.toLowerCase() === candidate?.toLowerCase());
    if (exact) return exact;
    const language = candidate?.split('-')[0]?.toLowerCase();
    const partial = SITE_CONFIG.supportedLocales.find(locale => locale.split('-')[0].toLowerCase() === language);
    if (partial) return partial;
  }

  return SITE_CONFIG.defaultLocale;
}

export function getLocale() {
  return document.documentElement.lang || detectLocale();
}

export function t(path, locale = getLocale()) {
  return path.split('.').reduce((value, key) => value?.[key], I18N[locale]) ?? path;
}

export function saveLocale(locale) {
  if (!SITE_CONFIG.supportedLocales.includes(locale)) return;
  localStorage.setItem(SITE_CONFIG.localeStorageKey, locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent('site:locale-change', { detail: locale }));
}

export function getProjects() {
  return PROJECTS.filter(project => project.enabled !== false);
}
