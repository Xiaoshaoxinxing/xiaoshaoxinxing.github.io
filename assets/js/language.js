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

  let initialLanguage = 'en';
  try {
    if (localStorage.getItem(storageKey) === 'zh-CN') initialLanguage = 'zh-CN';
  } catch { /* The switch also works with browser storage disabled. */ }
  setLanguage(initialLanguage);
  switcher.hidden = false;

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      if (document.documentElement.lang === language) return;
      setLanguage(language);
      try { localStorage.setItem(storageKey, language); } catch { /* Session-only choice. */ }
    });
  }
})();
