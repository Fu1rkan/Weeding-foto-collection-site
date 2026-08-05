import { useEffect } from 'react';

export function useInfiniteScroll({
  hasMore,
  isEnabled = true,
  isLoading,
  onLoadMore,
  targetRef,
}) {
  useEffect(() => {
    const target = targetRef.current;

    if (!target || !isEnabled || !hasMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading) {
          onLoadMore();
        }
      },
      {
        rootMargin: '360px',
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, isEnabled, isLoading, onLoadMore, targetRef]);
}
