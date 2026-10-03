(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;

    e.preventDefault();
    var text = btn.getAttribute('data-copy');

    function done() {
      btn.classList.add('is-done');
      btn.setAttribute('aria-label', 'Copied');
      setTimeout(function () {
        btn.classList.remove('is-done');
        btn.setAttribute('aria-label', 'Copy install command');
      }, 1400);
    }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) {}
      document.body.removeChild(ta);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
      return;
    }
    fallback();
  });
})();

(function () {
  'use strict';

  var root = document.querySelector('[data-list]');
  if (!root) return;

  var items = Array.prototype.slice.call(root.querySelectorAll('[data-item]'));
  if (!items.length) return;

  var search  = document.querySelector('[data-search-input]');
  var sortSel = document.querySelector('[data-sort]');
  var count   = document.querySelector('[data-count]');
  var sortLbl = document.querySelector('[data-sort-label]');
  var empty   = document.querySelector('[data-empty]');
  var reset   = document.querySelector('[data-reset]');
  var facets  = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));

  items.forEach(function (el) {
    el.dataset.haystack = el.textContent.replace(/\s+/g, ' ').toLowerCase();
    var desc = el.querySelector('[data-desc]');
    if (desc) desc.dataset.original = desc.textContent;
  });

  function date(el) { return parseInt(el.dataset.date, 10) || 0; }
  function title(el) { return el.dataset.title || ''; }

  function byTitle(a, b) { return title(a).localeCompare(title(b)); }
  function byNewest(a, b) { return date(b) - date(a) || byTitle(a, b); }

  var SORTS = {
    newest: byNewest,
    oldest: function (a, b) { return date(a) - date(b) || byTitle(a, b); },
    az:     byTitle
  };

  function resort() {
    var mode = sortSel ? sortSel.value : 'newest';
    var frag = document.createDocumentFragment();
    items.slice().sort(SORTS[mode] || SORTS.newest).forEach(function (el) {
      frag.appendChild(el);
    });
    root.appendChild(frag);
    if (sortLbl && sortSel) {
      sortLbl.textContent = sortSel.options[sortSel.selectedIndex].text;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(el, term) {
    var original = el.dataset.original || '';
    if (!term || term.length < 2) { el.textContent = original; return; }
    var i = original.toLowerCase().indexOf(term);
    if (i === -1) { el.textContent = original; return; }
    var out = '';
    var from = 0;
    while (i !== -1) {
      out += escapeHtml(original.slice(from, i));
      out += '<mark>' + escapeHtml(original.substr(i, term.length)) + '</mark>';
      from = i + term.length;
      i = original.toLowerCase().indexOf(term, from);
    }
    out += escapeHtml(original.slice(from));
    el.innerHTML = out;
  }

  function apply() {
    var q = (search ? search.value : '').trim().toLowerCase();
    var shown = 0;

    items.forEach(function (el) {
      var show = !q || el.dataset.haystack.indexOf(q) !== -1;

      for (var i = 0; show && i < facets.length; i++) {
        var want = facets[i].value;
        if (want === 'all') continue;
        show = (el.dataset[facets[i].dataset.filter] || '') === want;
      }

      el.classList.toggle('is-hidden', !show);

      var desc = el.querySelector('[data-desc]');
      if (desc) highlight(desc, show ? q : '');

      if (show) shown++;
    });

    if (count) count.textContent = shown;
    if (empty) empty.classList.toggle('is-on', shown === 0);

    var dirty = !!q || (sortSel && sortSel.value !== 'newest') || facets.some(function (f) {
      return f.value !== 'all';
    });
    if (reset) reset.classList.toggle('is-on', !!dirty);
  }

  function clearAll() {
    if (search) search.value = '';
    if (sortSel) sortSel.value = 'newest';
    facets.forEach(function (f) { f.value = 'all'; });
    resort();
    apply();
    if (search) search.focus();
  }

  if (search) search.addEventListener('input', apply);
  facets.forEach(function (f) { f.addEventListener('change', apply); });
  if (sortSel) sortSel.addEventListener('change', function () { resort(); apply(); });
  if (reset) reset.addEventListener('click', clearAll);

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      if (search) search.focus();
    } else if (e.key === 'Escape' && typing) {
      clearAll();
      document.activeElement.blur();
    }
  });

  resort();
  apply();
})();
