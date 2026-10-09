(() => {
  'use strict';

  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('[data-theme-toggle]');

  function label() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', `Switch to ${next} theme`);
    toggle.title = `Switch to ${next} theme`;
  }

  function apply(theme) {
    root.dataset.theme = theme;
    label();
    try { localStorage.setItem('gsb-theme', theme); } catch (error) {}
  }

  if (toggle) {
    label();

    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';

      if (!document.startViewTransition || calm.matches) {
        apply(next);
        return;
      }

      const box = toggle.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

      root.classList.add('is-theming');
      const shift = document.startViewTransition(() => apply(next));

      shift.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
          { duration: 820, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      });

      shift.finished.finally(() => root.classList.remove('is-theming'));
    });
  }

  if ('popover' in HTMLElement.prototype) {
    [
      { panel: document.getElementById('menu'), wide: '(min-width: 761px)' },
      { panel: document.getElementById('contents'), wide: '(min-width: 1061px)' }
    ].forEach(({ panel, wide }) => {
      if (!panel) return;

      panel.addEventListener('click', (event) => {
        if (event.target.closest('a')) panel.hidePopover();
      });

      matchMedia(wide).addEventListener('change', (event) => {
        if (event.matches && panel.matches(':popover-open')) panel.hidePopover();
      });
    });
  }

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

    const caption = button.querySelector('.copy-label');
    button.dataset.label ??= button.getAttribute('aria-label');
    button.classList.add('is-done');
    button.setAttribute('aria-label', 'Copied');
    if (caption) caption.textContent = 'Copied';

    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => {
      button.classList.remove('is-done');
      button.setAttribute('aria-label', button.dataset.label);
      if (caption) caption.textContent = 'Copy';
    }, 1600));
  });

  if (!calm.matches && 'IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('is-pending');
        watcher.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });

    for (const element of document.querySelectorAll('[data-reveal]')) {
      if (element.getBoundingClientRect().top < innerHeight) continue;
      element.classList.add('is-pending');
      watcher.observe(element);
    }
  }
})();
