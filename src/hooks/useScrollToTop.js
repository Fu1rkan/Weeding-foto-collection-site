import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function scrollToPageTop() {
  const html = document.documentElement;
  const previousScrollBehavior = html.style.scrollBehavior;

  html.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);

  window.requestAnimationFrame(() => {
    html.style.scrollBehavior = previousScrollBehavior;
  });
}

export function useScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    scrollToPageTop();

    const frameId = window.requestAnimationFrame(scrollToPageTop);
    const timeoutId = window.setTimeout(scrollToPageTop, 0);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname]);
}
