(() => {
  const catalog = globalThis.venueRankCatalog;
  if (!catalog) return;

  const labels = { ccf: 'CCF', core: 'CORE', thcpl: 'TH-CPL' };
  const index = new Map();
  const key = value => value.normalize('NFKD').toLowerCase()
    .replace(/\p{M}/gu, '').replace(/&/g, 'and').replace(/[^\p{L}\p{N}+#]/gu, '');

  function addName(name, record) {
    const id = key(name);
    if (!id) return;
    if (!index.has(id)) index.set(id, new Set());
    index.get(id).add(record);
  }
  for (const [system, table] of Object.entries(catalog)) {
    // Some venues appear under more than one subject in a single list.
    const venues = new Map();
    for (const [abbr, name, grade, url, kind, extraNames = []] of table.rows) {
      const identity = [kind, key(name), grade].join('|');
      if (!venues.has(identity)) {
        venues.set(identity, { system, name, grade, url: url || table.source, kind,
          names: new Set(), titles: new Set([key(name)]) });
      }
      const record = venues.get(identity);
      for (const alias of [name, abbr, ...extraNames].filter(Boolean)) {
        record.names.add(alias);
        addName(alias, record);
        if (alias.trim().split(/\s+/).length >= 3) record.titles.add(key(alias));
      }
    }
  }

  function lookup(text, kind) {
    return [...(index.get(key(text)) || [])].filter(record => !kind || kind === record.kind);
  }

  // Compare titles only to disambiguate candidates already identified by an
  // exact name or abbreviation. Never search all venues by word similarity.
  const generic = new Set(('the a an of for on and in to annual international national conference ' +
    'conferences symposium meeting proceedings acm ieee cvf journal transactions trans').split(' '));
  function titleWords(name) {
    return new Set((name.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => !generic.has(word)));
  }
  function relatedTitles(left, right) {
    if (key(left) === key(right)) return true;
    const a = titleWords(left);
    const b = titleWords(right);
    const overlap = [...a].filter(word => b.has(word)).length;
    return overlap > 0 && 2 * overlap >= Math.max(a.size, b.size)
      && overlap >= Math.min(2, a.size, b.size);
  }
  function sameSeries(a, b) {
    return [...a.titles].some(title => b.titles.has(title)) || relatedTitles(a.name, b.name);
  }
  const secondaryVenue = /\b(workshops?|findings|companions?|demos?|tutorials?|tracks?|posters?)\b/i;

  function resolve(text, kind) {
    let matches = lookup(text, kind);
    if (!matches.length) {
      const clean = text.replace(/^proceedings of (?:the )?/i, '').replace(/^(?:19|20)\d{2}\s+/, '')
        .replace(/^\d+(?:st|nd|rd|th)\s+/i, '').replace(/[\s,]+(?:19|20)\d{2}$/, '').trim();
      const pair = clean.match(/^(.+?)\s*[（(]([^()（）]+)[)）]$/);
      const title = pair ? pair[1].trim() : clean;
      matches = lookup(title, kind);
      if (!matches.length && pair && !secondaryVenue.test(title)) {
        matches = lookup(pair[2], kind).filter(record => relatedTitles(record.name, title));
      }
    }
    if (!matches.length || new Set(matches.map(r => r.kind)).size !== 1) return [];
    // A bare abbreviation can refer to different series, even within one field.
    if (new Set(matches.map(r => r.system)).size !== matches.length) return [];
    if (matches.some(a => matches.some(b => !sameSeries(a, b)))) return [];

    const resolved = new Map(matches.map(record => [record.system, record]));
    const candidates = new Set();
    for (const record of matches) {
      for (const alias of record.names) {
        for (const other of lookup(alias, record.kind)) candidates.add(other);
      }
    }
    for (const system of Object.keys(labels)) {
      if (resolved.has(system)) continue;
      const compatible = [...candidates].filter(other => other.system === system
        && matches.some(record => sameSeries(other, record)));
      if (compatible.length === 1) resolved.set(system, compatible[0]);
    }
    return Object.keys(labels).map(system => resolved.get(system)).filter(Boolean);
  }

  for (const citation of document.querySelectorAll('.publications .periodical')) {
    citation.querySelector('.venue-ranks')?.remove();
    const badge = citation.closest('.pub-row')?.querySelector('.abbr .badge');
    const venue = citation.dataset.venue || citation.querySelector('em')?.textContent.trim()
      || badge?.textContent.trim() || badge?.title;
    if (!venue) continue;
    const matches = resolve(venue.trim(), citation.dataset.venueType);
    if (!matches.length) continue;
    const group = document.createElement('span');
    group.className = 'venue-ranks';
    for (const { system, name, grade, url } of matches) {
      const link = document.createElement('a');
      link.className = 'rank-' + system;
      link.href = url;
      link.textContent = labels[system] + '-' + grade;
      link.title = catalog[system].edition + ' · ' + name;
      group.append(link);
    }
    citation.append(' ', group);
  }
})();
