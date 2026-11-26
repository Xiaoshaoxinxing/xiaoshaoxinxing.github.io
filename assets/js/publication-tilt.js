(() => {
  const figures = document.querySelectorAll('.publications [data-tilt]');
  const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');

  function reset(figure) {
    figure.removeAttribute('data-tracking');
    for (const property of ['--turn-x', '--turn-y', '--badge-x', '--badge-y']) {
      figure.style.removeProperty(property);
    }
  }

  function offset(position, start, size) {
    return Math.max(-1, Math.min(1, 2 * (position - start) / size - 1));
  }

  for (const figure of figures) {
    figure.addEventListener('pointermove', event => {
      if (!motion.matches || event.pointerType === 'touch' || figure.matches(':focus-within')) return;
      // The outer frame stays still while its image link and badge move.
      const rect = figure.getBoundingClientRect();
      const x = offset(event.clientX, rect.left, rect.width);
      const y = offset(event.clientY, rect.top, rect.height);
      figure.style.setProperty('--turn-x', (-7 * y).toFixed(2) + 'deg');
      figure.style.setProperty('--turn-y', (7 * x).toFixed(2) + 'deg');
      figure.style.setProperty('--badge-x', (3 * x).toFixed(2) + 'px');
      figure.style.setProperty('--badge-y', (3 * y).toFixed(2) + 'px');
      figure.setAttribute('data-tracking', '');
    });
    for (const event of ['pointerleave', 'pointercancel', 'focusin']) {
      figure.addEventListener(event, () => reset(figure));
    }
  }

  const resetAll = () => figures.forEach(reset);
  motion.addEventListener('change', resetAll);
  window.addEventListener('blur', resetAll);
})();
