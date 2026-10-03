(function () {
  'use strict';

  var search  = document.getElementById('searchInput');
  var osSel   = document.getElementById('osFilter');
  var diffSel = document.getElementById('difficultyFilter');
  var sortSel = document.getElementById('sortOrder');
  var reset   = document.getElementById('resetFilters');
  var empty   = document.getElementById('emptyState');
  var count   = document.getElementById('resultCount');
  var sortLbl = document.getElementById('sortLabel');
  var list    = document.getElementById('writeupsList');
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));

  if (!entries.length) return;

  entries.forEach(function (el) {
    el.dataset.haystack = el.textContent.replace(/\s+/g, ' ').toLowerCase();
    var desc = el.querySelector('.entry-desc');
    if (desc) desc.dataset.original = desc.textContent;
  });

  var DIFF_RANK = { easy: 1, medium: 2, hard: 3, insane: 4 };

  function rank(el) { return DIFF_RANK[el.dataset.difficulty] || 99; }
  function date(el) { return parseInt(el.dataset.date, 10) || 0; }
  function title(el) { return el.dataset.title || ''; }

  function byTitle(a, b) { return title(a).localeCompare(title(b)); }
  function byNewest(a, b) { return date(b) - date(a) || byTitle(a, b); }

  var SORTS = {
    newest:  byNewest,
    oldest:  function (a, b) { return date(a) - date(b) || byTitle(a, b); },
    az:      byTitle,
    easiest: function (a, b) { return rank(a) - rank(b) || byNewest(a, b); },
    hardest: function (a, b) { return rank(b) - rank(a) || byNewest(a, b); }
  };

  function resort() {
    if (!list) return;
    var mode = sortSel ? sortSel.value : 'newest';
    var cmp = SORTS[mode] || SORTS.newest;
    var frag = document.createDocumentFragment();
    entries.slice().sort(cmp).forEach(function (el) { frag.appendChild(el); });
    list.appendChild(frag);
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
    var q    = (search ? search.value : '').trim().toLowerCase();
    var os   = osSel ? osSel.value : 'all';
    var diff = diffSel ? diffSel.value : 'all';
    var shown = 0;

    entries.forEach(function (el) {
      var okSearch = !q || el.dataset.haystack.indexOf(q) !== -1;
      var okOs     = os === 'all' || el.dataset.os === os;
      var okDiff   = diff === 'all' || el.dataset.difficulty === diff;

      var show = okSearch && okOs && okDiff;
      el.classList.toggle('is-hidden', !show);

      var desc = el.querySelector('.entry-desc');
      if (desc) highlight(desc, show ? q : '');

      if (show) shown++;
    });

    if (count) count.textContent = shown;
    if (empty) empty.classList.toggle('is-on', shown === 0);

    var sort = sortSel ? sortSel.value : 'newest';
    var dirty = !!q || os !== 'all' || diff !== 'all' || sort !== 'newest';
    if (reset) reset.classList.toggle('is-on', dirty);
  }

  function clearAll() {
    if (search) search.value = '';
    if (sortSel) sortSel.value = 'newest';
    if (osSel) osSel.value = 'all';
    if (diffSel) diffSel.value = 'all';
    resort();
    apply();
    if (search) search.focus();
  }

  if (search) search.addEventListener('input', apply);
  if (osSel) osSel.addEventListener('change', apply);
  if (diffSel) diffSel.addEventListener('change', apply);
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
