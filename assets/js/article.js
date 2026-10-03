(() => {
  'use strict';

  const body = document.getElementById('articleBody');
  if (!body) return;

  const tocs = [...document.querySelectorAll('.toc')];
  const rail = document.querySelector('.rail .toc');
  const sections = [];

  body.querySelectorAll('h2, h3').forEach((heading) => {
    const label = heading.textContent.trim();
    if (!heading.id) heading.id = label.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

    if (heading.tagName === 'H2') {
      const anchor = document.createElement('a');
      anchor.className = 'anchor';
      anchor.href = `#${heading.id}`;
      anchor.textContent = '#';
      anchor.setAttribute('aria-label', `Link to ${label}`);
      heading.append(anchor);
    }

    sections.push({
      heading,
      links: tocs.map((toc) => {
        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.textContent = label;
        if (heading.tagName === 'H3') link.className = 'toc-sub';
        toc.append(link);
        return link;
      })
    });
  });

  let current = null;

  function placeIndicator() {
    if (!rail || !current) return;
    const link = current.links[tocs.indexOf(rail)];
    rail.style.setProperty('--toc-y', `${link.offsetTop}px`);
    rail.style.setProperty('--toc-h', link.offsetHeight);
  }

  function spy() {
    const line = innerHeight * 0.4;
    let active = sections[0];
    sections.forEach((section) => {
      if (section.heading.getBoundingClientRect().top <= line) active = section;
    });
    if (active === current) return;

    if (current) current.links.forEach((link) => link.removeAttribute('aria-current'));
    active.links.forEach((link) => link.setAttribute('aria-current', 'location'));
    current = active;
    placeIndicator();
  }

  if (sections.length) {
    const observer = new IntersectionObserver(spy, { rootMargin: '0px 0px -60% 0px' });
    sections.forEach((section) => observer.observe(section.heading));
    addEventListener('resize', placeIndicator, { passive: true });
  }

  const template = document.getElementById('codeCopy');

  const codeBody = document.getElementById('codeBody');
  const blocks = [...body.querySelectorAll('div.highlighter-rouge')];
  if (codeBody) blocks.push(...codeBody.querySelectorAll('div.highlighter-rouge'));

  blocks.forEach((block) => {
    const code = block.querySelector('pre code');
    if (!code) return;

    const language = /language-([\w-]+)/.exec(block.className);
    const head = document.createElement('div');
    head.className = 'code-head';

    const name = document.createElement('span');
    name.className = 'code-lang';
    name.textContent = language && language[1] !== 'plaintext' ? language[1] : 'text';

    const button = template.content.firstElementChild.cloneNode(true);
    button.dataset.copy = code.textContent;

    head.append(name, button);
    block.prepend(head);
  });

  const article = document.querySelector('.article');
  const switches = [...document.querySelectorAll('.view-btn')];

  function setView(view) {
    if (!codeBody) return;
    article.dataset.view = view;
    body.hidden = view === 'code';
    codeBody.hidden = view !== 'code';
    switches.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  }

  switches.forEach((button) => button.addEventListener('click', () => {
    const view = button.dataset.view === article.dataset.view
      ? (button.dataset.view === 'code' ? 'writeup' : 'code')
      : button.dataset.view;
    setView(view);
    history.replaceState(null, '', view === 'code' ? '#code' : location.pathname);
  }));

  if (location.hash === '#code') setView('code');

  body.querySelectorAll('table').forEach((table) => {
    const scroller = document.createElement('div');
    scroller.className = 'table-scroll';
    table.before(scroller);
    scroller.append(table);
  });
})();
