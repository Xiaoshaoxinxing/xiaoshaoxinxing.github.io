(() => {
  const switcher = document.querySelector('.language-switch');
  const buttons = switcher.querySelectorAll('[data-language]');
  const storageKey = 'academic-homepage-language';
  const translations = [];
  const affiliation = document.querySelector('.profile-affiliation');
  const [school, university] = affiliation.children;

  for (const attribute of ['textContent', 'content', 'aria-label', 'alt', 'title']) {
    const source = attribute === 'textContent' ? 'data-zh' : 'data-zh-' + attribute;
    for (const element of document.querySelectorAll('[' + source + ']')) {
      const english = attribute === 'textContent' ? element.textContent : element.getAttribute(attribute);
      translations.push({ element, attribute, en: english, 'zh-CN': element.getAttribute(source) });
    }
  }

  function setLanguage(language) {
    for (const entry of translations) {
      if (entry.attribute === 'textContent') {
        entry.element.textContent = entry[language];
      } else {
        entry.element.setAttribute(entry.attribute, entry[language]);
      }
    }
    affiliation.prepend(language === 'zh-CN' ? university : school);
    document.documentElement.lang = language;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    }
  }

  function languageInUrl(url) {
    const value = url.searchParams.get('lang')?.toLowerCase();
    if (value === 'zh' || value === 'zh-cn') return 'zh-CN';
    if (value === 'en') return 'en';
    return null;
  }

  let defaultLanguage = 'en';
  try {
    if (localStorage.getItem(storageKey) === 'zh-CN') defaultLanguage = 'zh-CN';
  } catch { /* The switch also works with browser storage disabled. */ }

  function restoreLanguage() {
    const explicit = languageInUrl(new URL(location.href));
    // A history entry without a language parameter keeps its original language on Back.
    const previous = history.state?.[storageKey];
    const language = explicit || (previous === 'zh-CN' || previous === 'en' ? previous : defaultLanguage);
    setLanguage(language);
    if (!explicit && previous !== language) {
      try { history.replaceState({ ...history.state, [storageKey]: language }, ''); } catch { /* Optional history support. */ }
    }
  }

  restoreLanguage();
  window.addEventListener('popstate', restoreLanguage);
  switcher.hidden = false;

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      const alreadyActive = document.documentElement.lang === language;
      if (!alreadyActive) setLanguage(language);
      try { localStorage.setItem(storageKey, language); } catch { /* Session-only choice. */ }
      const url = new URL(location.href);
      const parameter = language === 'zh-CN' ? 'zh' : 'en';
      if (url.searchParams.get('lang') === parameter) return;
      url.searchParams.set('lang', parameter);
      try {
        if (alreadyActive) history.replaceState(history.state, '', url);
        else history.pushState(null, '', url);
      } catch { /* Local file previews may restrict URL changes. */ }
    });
  }
})();
