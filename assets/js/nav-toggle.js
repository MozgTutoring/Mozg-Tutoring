(() => {
  function goHome(smooth = true) {
    // Remove the hash without a full reload; "./" works on root and GitHub Pages subpaths
    try {
      history.replaceState(null, '', './');
    } catch {
      // Fallback: clear hash
      const url = location.href.split('#')[0];
      location.replace(url);
    }
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      window.scrollTo(0, 0);
    }
  }

  function onAnchorClick(e) {
    const href = this.getAttribute('href') || '';
    if (!href.startsWith('#')) return;

    const current = window.location.hash || '';
    const target = href;

    // If user clicks the same section link again, go "home"
    if (current === target) {
      e.preventDefault();
      goHome(true);
    }
  }

  function init() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', onAnchorClick, { passive: false });
    });

    // If hash becomes empty via browser navigation, ensure we’re at top
    window.addEventListener('hashchange', () => {
      if (!location.hash) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();