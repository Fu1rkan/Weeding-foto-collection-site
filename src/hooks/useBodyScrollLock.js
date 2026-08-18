import { useEffect } from 'react';

let activeLockCount = 0;
let previousPageStyles = null;

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;

    if (activeLockCount === 0) {
      previousPageStyles = {
        bodyOverscrollBehavior: body.style.overscrollBehavior,
        overflow: body.style.overflow,
        htmlOverscrollBehavior: html.style.overscrollBehavior,
        htmlOverflow: html.style.overflow,
      };

      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);

      if (activeLockCount > 0 || !previousPageStyles) {
        return;
      }

      body.style.overflow = previousPageStyles.overflow;
      body.style.overscrollBehavior = previousPageStyles.bodyOverscrollBehavior;
      html.style.overflow = previousPageStyles.htmlOverflow;
      html.style.overscrollBehavior = previousPageStyles.htmlOverscrollBehavior;

      previousPageStyles = null;
    };
  }, [isLocked]);
}
