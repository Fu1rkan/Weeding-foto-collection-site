import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { getGalleryMediaPage } from '../services/mediaGalleryService.js';

const mediaFilterOptions = [
  { label: 'Alle', value: 'all' },
  { label: 'Nur Bilder', value: 'image' },
  { label: 'Nur Videos', value: 'video' },
];

const sortOptions = [
  { label: 'Neueste zuerst', value: 'desc' },
  { label: 'Älteste zuerst', value: 'asc' },
];

function GalleryMedia({ item, isLightbox = false }) {
  if (item.mediaKind === 'video') {
    return (
      <video
        controls={isLightbox}
        muted={!isLightbox}
        playsInline
        poster={item.thumbnailUrl || undefined}
        preload={isLightbox ? 'metadata' : 'none'}
        src={item.downloadUrl}
      />
    );
  }

  const imageUrl = isLightbox
    ? item.downloadUrl
    : item.thumbnailUrl ?? item.downloadUrl;
  const responsiveSrcSet =
    !isLightbox && item.thumbnailUrl
      ? `${item.thumbnailUrl} 720w, ${item.downloadUrl} 2200w`
      : undefined;

  return (
    <img
      alt={item.fileName}
      decoding="async"
      loading={isLightbox ? 'eager' : 'lazy'}
      sizes={
        isLightbox
          ? '100vw'
          : '(max-width: 420px) calc(100vw - 2rem), (max-width: 900px) calc((100vw - 3rem) / 2), 380px'
      }
      src={imageUrl}
      srcSet={responsiveSrcSet}
    />
  );
}

export default function GalleryPage() {
  usePageTitle('Galerie');

  const [errorMessage, setErrorMessage] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all');
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sortOrder, setSortOrder] = useState('desc');
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const selectedItem = selectedIndex >= 0 ? mediaItems[selectedIndex] : null;
  const hasLightboxNavigation = mediaItems.length > 1;

  const showPreviousItem = useCallback(() => {
    setSelectedIndex((currentIndex) => {
      if (currentIndex < 0 || mediaItems.length === 0) {
        return currentIndex;
      }

      return currentIndex === 0 ? mediaItems.length - 1 : currentIndex - 1;
    });
  }, [mediaItems.length]);

  const showNextItem = useCallback(() => {
    setSelectedIndex((currentIndex) => {
      if (currentIndex < 0 || mediaItems.length === 0) {
        return currentIndex;
      }

      return currentIndex === mediaItems.length - 1 ? 0 : currentIndex + 1;
    });
  }, [mediaItems.length]);

  const loadMore = useCallback(async ({ reset = false } = {}) => {
    if (isLoadingRef.current || (!reset && !hasMoreRef.current)) {
      return;
    }

    if (reset) {
      cursorRef.current = null;
      hasMoreRef.current = true;
      setHasMore(true);
      setMediaItems([]);
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await getGalleryMediaPage({
        cursor: reset ? null : cursorRef.current,
        mediaFilter,
        sortOrder,
      });

      setMediaItems((currentItems) =>
        reset ? result.items : [...currentItems, ...result.items],
      );
      cursorRef.current = result.cursor;
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
    } catch {
      setErrorMessage(
        'Die Galerie konnte nicht geladen werden. Bitte lade die Seite neu oder melde dich erneut über den Gästecode an.',
      );
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [mediaFilter, sortOrder]);

  useEffect(() => {
    loadMore({ reset: true });
  }, [loadMore]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setSelectedIndex(-1);
        return;
      }

      if (!selectedItem) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        showPreviousItem();
      }

      if (event.key === 'ArrowRight') {
        showNextItem();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, showNextItem, showPreviousItem]);

  useInfiniteScroll({
    hasMore,
    isEnabled: !errorMessage,
    isLoading,
    onLoadMore: loadMore,
    targetRef: sentinelRef,
  });

  return (
    <section className="gallery-page">
      <div className="section-card gallery-header">
        <div className="section-heading">
          <p className="eyebrow">Galerie</p>
          <h1>Geteilte Erinnerungen</h1>
          <p>
            Hier erscheinen alle hochgeladenen Bilder und Videos der Gäste. Beim
            Scrollen werden weitere Erinnerungen automatisch nachgeladen.
          </p>
        </div>

        <div className="gallery-controls" aria-label="Galerie filtern und sortieren">
          <div className="segmented-control" aria-label="Medientyp filtern">
            {mediaFilterOptions.map((option) => (
              <button
                aria-pressed={mediaFilter === option.value}
                className={mediaFilter === option.value ? 'is-active' : ''}
                disabled={isLoading}
                key={option.value}
                onClick={() => {
                  setMediaFilter(option.value);
                  setSelectedIndex(-1);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="sort-control" htmlFor="gallery-sort">
            Sortierung
            <select
              disabled={isLoading}
              id="gallery-sort"
              onChange={(event) => {
                setSortOrder(event.target.value);
                setSelectedIndex(-1);
              }}
              value={sortOrder}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {errorMessage && (
        <p className="feedback-message is-error" role="alert">
          {errorMessage}
        </p>
      )}

      {mediaItems.length > 0 && (
        <div className="masonry-gallery" aria-label="Hochgeladene Medien">
          {mediaItems.map((item, index) => (
            <article className="gallery-media-card" key={item.id}>
              <button
                aria-label={`${item.fileName} in Lightbox öffnen`}
                className="gallery-media-button"
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <GalleryMedia item={item} />
                {item.mediaKind === 'video' && (
                  <span className="video-badge">Video</span>
                )}
              </button>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && !hasMore && mediaItems.length === 0 && (
        <div className="empty-gallery">
          <p className="eyebrow">Noch leer</p>
          <h2>Noch keine Erinnerungen hochgeladen.</h2>
          <p>Für den aktuellen Filter wurden keine Medien gefunden.</p>
        </div>
      )}

      {isLoading && (
        <div className="gallery-loading" aria-live="polite">
          <span />
          <p>Weitere Erinnerungen werden geladen...</p>
        </div>
      )}

      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />

      {!hasMore && mediaItems.length > 0 && (
        <p className="gallery-end">Ihr habt alle bisherigen Erinnerungen gesehen.</p>
      )}

      {selectedItem && (
        <div
          aria-modal="true"
          className="lightbox"
          onClick={() => setSelectedIndex(-1)}
          role="dialog"
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="Lightbox schließen"
              className="lightbox-close"
              onClick={() => setSelectedIndex(-1)}
              type="button"
            >
              ×
            </button>
            {hasLightboxNavigation && (
              <>
                <button
                  aria-label="Vorheriges Medium anzeigen"
                  className="lightbox-nav lightbox-nav-prev"
                  onClick={showPreviousItem}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Nächstes Medium anzeigen"
                  className="lightbox-nav lightbox-nav-next"
                  onClick={showNextItem}
                  type="button"
                >
                  ›
                </button>
              </>
            )}
            <div className="lightbox-media">
              <GalleryMedia item={selectedItem} isLightbox />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
