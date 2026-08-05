import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { getGalleryMediaPage } from '../services/mediaGalleryService.js';
import { formatFileSize } from '../utils/fileUtils.js';

const mediaFilterOptions = [
  { label: 'Alle', value: 'all' },
  { label: 'Nur Bilder', value: 'image' },
  { label: 'Nur Videos', value: 'video' },
];

const sortOptions = [
  { label: 'Neueste zuerst', value: 'desc' },
  { label: 'Älteste zuerst', value: 'asc' },
];

function formatUploadDate(uploadedAt) {
  const date = uploadedAt?.toDate?.();

  if (!date) {
    return 'Gerade eben';
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function GalleryMedia({ item, isLightbox = false }) {
  if (item.mediaKind === 'video') {
    return (
      <video
        controls={isLightbox}
        muted={!isLightbox}
        playsInline
        preload="metadata"
        src={item.downloadUrl}
      />
    );
  }

  return (
    <img
      alt={item.fileName}
      decoding="async"
      loading={isLightbox ? 'eager' : 'lazy'}
      src={item.downloadUrl}
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
  const [selectedItem, setSelectedItem] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const sentinelRef = useRef(null);

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
        'Die Galerie konnte nicht geladen werden. Bitte prüfe die Firestore-Berechtigungen.',
      );
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
        setSelectedItem(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useInfiniteScroll({
    hasMore,
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
                  setSelectedItem(null);
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
                setSelectedItem(null);
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
          {mediaItems.map((item) => (
            <article className="gallery-media-card" key={item.id}>
              <button
                aria-label={`${item.fileName} in Lightbox öffnen`}
                className="gallery-media-button"
                onClick={() => setSelectedItem(item)}
                type="button"
              >
                <GalleryMedia item={item} />
                {item.mediaKind === 'video' && (
                  <span className="video-badge">Video</span>
                )}
              </button>

              <div className="gallery-media-info">
                <h3>{item.fileName}</h3>
                <p>
                  {formatFileSize(item.fileSize)} · {formatUploadDate(item.uploadedAt)}
                </p>
              </div>
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
          onClick={() => setSelectedItem(null)}
          role="dialog"
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="Lightbox schließen"
              className="lightbox-close"
              onClick={() => setSelectedItem(null)}
              type="button"
            >
              ×
            </button>
            <div className="lightbox-media">
              <GalleryMedia item={selectedItem} isLightbox />
            </div>
            <div className="lightbox-caption">
              <h3>{selectedItem.fileName}</h3>
              <p>
                {formatFileSize(selectedItem.fileSize)} ·{' '}
                {formatUploadDate(selectedItem.uploadedAt)}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
