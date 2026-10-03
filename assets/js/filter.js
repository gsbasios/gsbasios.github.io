(() => {
  'use strict';

  const list = document.querySelector('[data-list]');
  if (!list) return;

  const items = [...list.querySelectorAll('[data-item]')];
  const search = document.querySelector('[data-search]');
  const sort = document.querySelector('[data-sort]');
  const facets = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('[data-count]');
  const sortLabel = document.querySelector('[data-sort-label]');
  const empty = document.querySelector('[data-empty]');
  const clear = document.querySelector('.reset');

  items.forEach((item) => {
    item.dataset.haystack = item.textContent.replace(/\s+/g, ' ').toLowerCase();
    const desc = item.querySelector('[data-desc]');
    if (desc) desc.dataset.original = desc.textContent;
  });

  const value = (item, key) => Number(item.dataset[key]) || 0;
  const byTitle = (a, b) => a.dataset.title.localeCompare(b.dataset.title);
  const byNewest = (a, b) => value(b, 'date') - value(a, 'date') || byTitle(a, b);

  const orders = {
    newest: byNewest,
    oldest: (a, b) => value(a, 'date') - value(b, 'date') || byTitle(a, b),
    title: byTitle,
    rank: (a, b) => value(a, 'rank') - value(b, 'rank') || byNewest(a, b),
    'rank-desc': (a, b) => value(b, 'rank') - value(a, 'rank') || byNewest(a, b)
  };

  function highlight(element, term) {
    const text = element.dataset.original;
    element.textContent = '';
    if (term.length < 2) {
      element.textContent = text;
      return;
    }

    const lower = text.toLowerCase();
    let from = 0;
    let at = lower.indexOf(term);
    while (at !== -1) {
      const mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + term.length);
      element.append(text.slice(from, at), mark);
      from = at + term.length;
      at = lower.indexOf(term, from);
    }
    element.append(text.slice(from));
  }

  function apply() {
    const term = search.value.trim().toLowerCase();
    let shown = 0;

    items.forEach((item) => {
      const match = item.dataset.haystack.includes(term) &&
        facets.every((facet) => facet.value === 'all' || item.dataset[facet.dataset.filter] === facet.value);

      item.hidden = !match;
      const desc = item.querySelector('[data-desc]');
      if (desc) highlight(desc, match ? term : '');
      if (match) shown += 1;
    });

    count.textContent = shown;
    empty.hidden = shown > 0;

    const dirty = Boolean(term) || sort.value !== 'newest' || facets.some((facet) => facet.value !== 'all');
    clear.classList.toggle('is-on', dirty);
  }

  function reorder() {
    list.append(...items.slice().sort(orders[sort.value] || byNewest));
    sortLabel.textContent = sort.selectedOptions[0].text;
  }

  function reset() {
    search.value = '';
    sort.value = 'newest';
    facets.forEach((facet) => { facet.value = 'all'; });
    list.classList.remove('is-instant');
    reorder();
    apply();
  }

  search.addEventListener('input', () => {
    list.classList.add('is-instant');
    apply();
  });

  facets.forEach((facet) => facet.addEventListener('change', () => {
    list.classList.remove('is-instant');
    apply();
  }));

  sort.addEventListener('change', () => {
    list.classList.remove('is-instant');
    reorder();
    apply();
  });

  document.querySelectorAll('[data-reset]').forEach((button) => button.addEventListener('click', () => {
    reset();
    search.focus();
  }));

  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest('input, select, textarea');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      search.focus();
    } else if (event.key === 'Escape' && typing) {
      reset();
      event.target.blur();
    }
  });

  apply();
})();
