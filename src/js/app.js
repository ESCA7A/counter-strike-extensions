import { SITE_CONFIG, I18N } from '../../config/site.config.js';
import { detectLocale, saveLocale, t, getPath, getProjects } from '../../config/loader.js';

const components = {
  navigation: document.querySelector('[data-component="navigation"]'),
  hero: document.querySelector('[data-component="hero"]'),
  about: document.querySelector('[data-component="about"]'),
  projects: document.querySelector('[data-component="projects"]'),
  footer: document.querySelector('[data-component="footer"]')
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function renderNavigation(locale) {
  components.navigation.innerHTML = `
    <div class="nav-shell">
      <a class="brand" href="${getPath('/')}" aria-label="ESCA7A">ESCA7A<span>.</span></a>
      <nav class="nav-links" aria-label="Primary">
        <a href="${getPath('/')}" data-nav="home">${t('nav.home', locale)}</a>
        ${SITE_CONFIG.navigation.showProjects ? `<a href="${getPath('/projects/')}" data-nav="projects">${t('nav.projects', locale)}</a>` : ''}
        ${SITE_CONFIG.navigation.showPublications ? `<a href="${getPath('/publications/')}" data-nav="publications">${t('nav.publications', locale)}</a>` : ''}
        ${SITE_CONFIG.navigation.showAbout ? `<a href="${getPath('/about/')}" data-nav="about">${t('nav.about', locale)}</a>` : ''}
      </nav>
      <div class="nav-actions">
        ${SITE_CONFIG.navigation.showLanguageSwitcher ? `
          <label class="language-switcher">
            <span class="sr-only">${t('common.language', locale)}</span>
            <select data-language aria-label="${escapeHtml(t('common.language', locale))}">
              ${SITE_CONFIG.supportedLocales.map(item => `<option value="${item}" ${item === locale ? 'selected' : ''}>${item.split('-')[0].toUpperCase()}</option>`).join('')}
            </select>
          </label>` : ''}
        <a class="nav-github" href="${SITE_CONFIG.social.github}" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </div>`;

  components.navigation.querySelector('[data-language]')?.addEventListener('change', event => saveLocale(event.target.value));
}

function renderHero(locale) {
  components.hero.innerHTML = `
    <div class="hero-shell">
      <div class="hero-copy">
        <div class="eyebrow">${t('hero.eyebrow', locale)}</div>
        <h1>${t('hero.title', locale)}</h1>
        <p>${t('hero.text', locale)}</p>
        <a class="button button-primary" href="${getPath('/projects/')}">${t('hero.cta', locale)} <span>→</span></a>
      </div>
      <div class="hero-mark" aria-hidden="true">
        <div class="hero-grid"></div>
        <div class="hero-orb">CS<span>2</span></div>
      </div>
    </div>`;
}

function renderAbout(locale) {
  components.about.innerHTML = `
    <div class="about-shell section-shell">
      <div class="section-kicker">${t('about.eyebrow', locale)}</div>
      <div class="about-grid">
        <h2>${t('about.title', locale)}</h2>
        <p>${t('about.text', locale)}</p>
      </div>
    </div>`;
}

function renderProjects(locale) {
  const projects = getProjects();
  components.projects.innerHTML = `
    <div class="projects-shell section-shell">
      <div class="section-heading">
        <div><div class="section-kicker">${t('projects.eyebrow', locale)}</div><h2>${t('projects.title', locale)}</h2></div>
        <p>${t('projects.text', locale)}</p>
      </div>
      <div class="project-slider" data-slider>
        <div class="project-track" data-track>
          ${projects.map(project => {
            if (!project.featureFlags.showBanner) return '';
            const meta = project.meta[locale.split('-')[0]] ?? project.meta.en;
            return `<article class="project-card">
              <div class="project-card-top">
                <span class="project-type">${escapeHtml(project.type.replace('-', ' ').toUpperCase())}</span>
                ${project.featureFlags.showStatus ? '<span class="project-status"><i></i> ACTIVE</span>' : ''}
              </div>
              <div class="project-card-content">
                <div><h3>${escapeHtml(meta.name)}</h3><p>${escapeHtml(meta.short)}</p></div>
                ${project.featureFlags.showFeatures ? `<ul>${project.features[locale.split('-')[0]].map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
              </div>
              <div class="project-card-bottom">
                ${project.featureFlags.showLinks ? `<a class="button button-secondary" href="${getPath(project.route)}">${t('common.open', locale)} <span>↗</span></a>` : ''}
              </div>
            </article>`;
          }).join('')}
        </div>
        <div class="slider-controls">
          <button type="button" data-prev aria-label="${t('common.previous', locale)}">←</button>
          <button type="button" data-next aria-label="${t('common.next', locale)}">→</button>
        </div>
      </div>
    </div>`;

  const track = components.projects.querySelector('[data-track]');
  components.projects.querySelector('[data-prev]')?.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.86, behavior: 'smooth' }));
  components.projects.querySelector('[data-next]')?.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.86, behavior: 'smooth' }));
}

function renderFooter(locale) {
  components.footer.innerHTML = `
    <div class="footer-shell">
      <span>© ${new Date().getFullYear()} ESCA7A — ${t('footer.text', locale)}</span>
      <a href="${SITE_CONFIG.social.github}" target="_blank" rel="noreferrer">${t('footer.github', locale)} ↗</a>
    </div>`;
}

function render(locale) {
  document.documentElement.lang = locale;
  renderNavigation(locale); renderHero(locale); renderAbout(locale); renderProjects(locale); renderFooter(locale);
}

const initialLocale = detectLocale();
render(initialLocale);
window.addEventListener('site:locale-change', event => render(event.detail));
