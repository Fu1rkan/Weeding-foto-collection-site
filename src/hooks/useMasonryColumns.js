import { useEffect, useMemo, useState } from 'react';

function getColumnCount() {
  if (typeof window === 'undefined') {
    return 3;
  }

  if (window.matchMedia('(max-width: 980px)').matches) {
    return 2;
  }

  return 3;
}

export function useMasonryColumns(items) {
  const [columnCount, setColumnCount] = useState(getColumnCount);

  useEffect(() => {
    function handleResize() {
      setColumnCount(getColumnCount());
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => {
    const columns = Array.from({ length: columnCount }, () => []);

    items.forEach((item, index) => {
      columns[index % columnCount].push({
        index,
        item,
      });
    });

    return columns;
  }, [columnCount, items]);
}
