(() => {
  'use strict';

  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const easeOut = getComputedStyle(root).getPropertyValue('--ease-out').trim();

  const themeButton = document.getElementById('themeToggle');

  function labelTheme() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    themeButton.setAttribute('aria-label', `Switch to ${next} theme`);
    themeButton.title = `Switch to ${next} theme`;
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    labelTheme();
    try { localStorage.setItem('gsb-theme', theme); } catch (error) {}
  }

  labelTheme();

  themeButton.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }

    const box = themeButton.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    root.classList.add('is-theming');
    const transition = document.startViewTransition(() => setTheme(next));

    transition.ready.then(() => {
      if (!motion.matches) return;
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 640, easing: easeOut, pseudoElement: '::view-transition-new(root)' }
      );
    });

    transition.finished.finally(() => root.classList.remove('is-theming'));
  });

  const scrim = document.getElementById('scrim');
  const panels = [
    { button: 'menuToggle', panel: 'mobileNav', wide: '(min-width: 761px)' },
    { button: 'tocToggle', panel: 'mobileToc', wide: '(min-width: 1061px)' }
  ]
    .map((item) => ({
      button: document.getElementById(item.button),
      panel: document.getElementById(item.panel),
      wide: matchMedia(item.wide)
    }))
    .filter((item) => item.button && item.panel);

  function setPanel(item, open) {
    item.button.setAttribute('aria-expanded', String(open));
    item.panel.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', panels.some((other) => other.panel.classList.contains('is-open')));
  }

  function closePanels() {
    panels.forEach((item) => setPanel(item, false));
  }

  panels.forEach((item) => {
    item.button.addEventListener('click', () => {
      const open = item.button.getAttribute('aria-expanded') !== 'true';
      closePanels();
      setPanel(item, open);
    });

    item.panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) setPanel(item, false);
    });

    item.wide.addEventListener('change', (event) => {
      if (event.matches) setPanel(item, false);
    });
  });

  scrim.addEventListener('click', closePanels);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    panels.forEach((item) => {
      if (item.button.getAttribute('aria-expanded') !== 'true') return;
      setPanel(item, false);
      item.button.focus();
    });
  });

  let lit = null;
  let frame = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function follow() {
    const ease = motion.matches ? 0.18 : 1;
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    lit.style.setProperty('--x', `${pointer.x}px`);
    lit.style.setProperty('--y', `${pointer.y}px`);
    const settled = Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) < 0.5;
    frame = settled ? 0 : requestAnimationFrame(follow);
  }

  document.addEventListener('pointermove', (event) => {
    if (!finePointer.matches) return;
    const target = event.target.closest('[data-spotlight]');
    if (!target) return;

    const box = target.getBoundingClientRect();
    pointer.tx = event.clientX - box.left;
    pointer.ty = event.clientY - box.top;

    if (target !== lit) {
      lit = target;
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    }

    if (!frame) frame = requestAnimationFrame(follow);
  }, { passive: true });

  const copyTimers = new WeakMap();

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;

    event.preventDefault();
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
    } catch (error) {
      return;
    }

    const label = button.querySelector('.copy-label');
    button.dataset.label ??= button.getAttribute('aria-label');
    button.classList.add('is-done');
    button.setAttribute('aria-label', 'Copied');
    if (label) label.textContent = 'Copied';

    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => {
      button.classList.remove('is-done');
      button.setAttribute('aria-label', button.dataset.label);
      if (label) label.textContent = 'Copy';
    }, 1600));
  });

  if (motion.matches && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-pending');
        reveal.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    document.querySelectorAll('[data-reveal]').forEach((element) => {
      if (element.getBoundingClientRect().top < innerHeight) return;
      element.classList.add('is-pending');
      reveal.observe(element);
    });
  }
})();
