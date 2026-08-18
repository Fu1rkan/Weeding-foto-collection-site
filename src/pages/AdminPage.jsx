import { useEffect, useMemo, useRef, useState } from 'react';
import cancelIconMarkup from '../assets/icons/cancel.svg?raw';
import checkIconMarkup from '../assets/icons/check.svg?raw';
import downloadIconMarkup from '../assets/icons/download.svg?raw';
import selectIconMarkup from '../assets/icons/select.svg?raw';
import trashIconMarkup from '../assets/icons/trash.svg?raw';
import { VideoCover } from '../components/VideoCover.jsx';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import {
  DOWNLOAD_CORS_ERROR_CODE,
  deleteMediaItem,
  downloadMediaItems,
  getAdminMediaItems,
} from '../services/adminMediaService.js';
import { formatFileSize } from '../utils/fileUtils.js';

function formatUploadDate(uploadedAt) {
  const date = uploadedAt?.toDate?.();

  if (!date) {
    return 'Unbekannt';
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getMediaLabel(mediaKind) {
  return mediaKind === 'video' ? 'Video' : 'Bild';
}

function getDeleteLabel(mediaKind) {
  return mediaKind === 'video' ? 'Video löschen' : 'Bild löschen';
}

const STICKY_TOOLBAR_OFFSET = 16;

const adminIconSources = {
  check: checkIconMarkup,
  close: cancelIconMarkup,
  download: downloadIconMarkup,
  select: selectIconMarkup,
  trash: trashIconMarkup,
};

function prepareIconMarkup(markup) {
  return markup
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replaceAll('#000000', 'currentColor')
    .replaceAll('#000', 'currentColor')
    .replace(/\s(width|height)="[^"]*"/g, '');
}

function AdminIcon({ name }) {
  return (
    <span
      className="admin-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: prepareIconMarkup(adminIconSources[name]),
      }}
    />
  );
}

function matchesSearch(item, searchTerm) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  return [item.fileName, item.fileType, getMediaLabel(item.mediaKind)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
}

function getActionCopy(type, scope, count) {
  const isSingle = count === 1;
  const scopeLabel =
    scope === 'all'
      ? 'alle angezeigten Dateien'
      : isSingle
        ? 'diese Datei'
        : 'alle ausgewählten Dateien';

  if (type === 'delete') {
    return {
      confirmLabel: 'Endgültig löschen',
      description: `Möchtest du wirklich ${scopeLabel} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      title: isSingle ? 'Datei löschen?' : 'Dateien löschen?',
    };
  }

  return {
    confirmLabel: 'Download starten',
    description: `Möchtest du wirklich ${scopeLabel} herunterladen? Je nach Browser können mehrere Downloads einzeln bestätigt werden müssen.`,
    title: isSingle ? 'Datei herunterladen?' : 'Dateien herunterladen?',
  };
}

function getActionErrorMessage(actionType, error) {
  if (actionType === 'delete') {
    return 'Nicht alle Dateien konnten gelöscht werden. Bitte prüfe Storage- und Firestore-Berechtigungen.';
  }

  if (error?.code === DOWNLOAD_CORS_ERROR_CODE) {
    return 'Der Download wird von Firebase Storage blockiert. Bitte wende die Storage-CORS-Konfiguration an und versuche es danach erneut.';
  }

  return 'Nicht alle Dateien konnten heruntergeladen werden. Bitte versuche es erneut.';
}

function AdminMedia({ item, isLightbox = false }) {
  if (item.mediaKind === 'video') {
    return (
      <VideoCover
        downloadUrl={item.downloadUrl}
        fileName={item.fileName}
        isLightbox={isLightbox}
        thumbnailUrl={item.thumbnailUrl}
      />
    );
  }

  const imageUrl = isLightbox
    ? item.downloadUrl
    : item.thumbnailUrl ?? item.downloadUrl;

  return (
    <img
      alt={item.fileName}
      decoding="async"
      loading={isLightbox ? 'eager' : 'lazy'}
      sizes={isLightbox ? '100vw' : '8rem'}
      src={imageUrl}
      srcSet={
        !isLightbox && item.thumbnailUrl
          ? `${item.thumbnailUrl} 720w, ${item.downloadUrl} 2200w`
          : undefined
      }
    />
  );
}

function ConfirmationDialog({
  actionProgress,
  confirmDelaySeconds,
  isWorking,
  onCancel,
  onConfirm,
  pendingAction,
}) {
  if (!pendingAction) {
    return null;
  }

  const isDeleteAction = pendingAction.type === 'delete';
  const isConfirmDisabled =
    isWorking || (isDeleteAction && confirmDelaySeconds > 0);
  const buttonLabel = isWorking
    ? 'Bitte warten...'
    : isDeleteAction && confirmDelaySeconds > 0
      ? `Bestätigen in ${confirmDelaySeconds}s`
      : pendingAction.confirmLabel;

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        aria-modal="true"
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <p className="eyebrow">{isDeleteAction ? 'Löschen' : 'Download'}</p>
        <h2>{pendingAction.title}</h2>
        <p>{pendingAction.description}</p>
        <p className="confirm-dialog-count">
          Betroffene Dateien: {pendingAction.items.length}
        </p>

        {actionProgress && (
          <p className="confirm-dialog-progress" aria-live="polite">
            {actionProgress.done} von {actionProgress.total} verarbeitet
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            className="secondary-button"
            disabled={isWorking}
            onClick={onCancel}
            type="button"
          >
            Abbrechen
          </button>
          <button
            className={isDeleteAction ? 'danger-button' : 'button-link'}
            disabled={isConfirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  usePageTitle('Admin');

  const [actionProgress, setActionProgress] = useState(null);
  const [adminCode, setAdminCode] = useState('');
  const [confirmDelaySeconds, setConfirmDelaySeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isActionWorking, setIsActionWorking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isToolbarCompact, setIsToolbarCompact] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(-1);
  const toolbarRef = useRef(null);
  const { isAuthenticated, isChecking, login } = useAdminAccess();

  const filteredItems = useMemo(
    () => mediaItems.filter((item) => matchesSearch(item, searchTerm)),
    [mediaItems, searchTerm],
  );
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item.id)),
    [filteredItems, selectedIds],
  );
  const selectedPreviewItem =
    selectedPreviewIndex >= 0 ? filteredItems[selectedPreviewIndex] : null;
  const hasLightboxNavigation = filteredItems.length > 1;
  const areAllFilteredItemsSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.id));

  useBodyScrollLock(Boolean(pendingAction || selectedPreviewItem));

  const stats = useMemo(() => {
    const imageCount = mediaItems.filter((item) => item.mediaKind === 'image').length;
    const videoCount = mediaItems.filter((item) => item.mediaKind === 'video').length;
    const totalBytes = mediaItems.reduce(
      (sum, item) => sum + Number(item.fileSize || 0),
      0,
    );

    return {
      imageCount,
      totalBytes,
      totalUploads: mediaItems.length,
      videoCount,
    };
  }, [mediaItems]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    async function loadMediaItems() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const items = await getAdminMediaItems();
        setMediaItems(items);
      } catch {
        setErrorMessage(
          'Die Admin-Daten konnten nicht geladen werden. Bitte prüfe die Firestore-Berechtigungen.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadMediaItems();
  }, [isAuthenticated]);

  useEffect(() => {
    setSelectedIds((currentSelectedIds) => {
      const availableIds = new Set(mediaItems.map((item) => item.id));
      const nextSelectedIds = new Set(
        [...currentSelectedIds].filter((id) => availableIds.has(id)),
      );

      return nextSelectedIds.size === currentSelectedIds.size
        ? currentSelectedIds
        : nextSelectedIds;
    });
  }, [mediaItems]);

  useEffect(() => {
    if (selectedPreviewIndex >= filteredItems.length) {
      setSelectedPreviewIndex(-1);
    }
  }, [filteredItems.length, selectedPreviewIndex]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let animationFrameId = 0;

    function updateToolbarState() {
      window.cancelAnimationFrame(animationFrameId);

      animationFrameId = window.requestAnimationFrame(() => {
        const toolbar = toolbarRef.current;

        if (!toolbar) {
          return;
        }

        setIsToolbarCompact(
          toolbar.getBoundingClientRect().top <= STICKY_TOOLBAR_OFFSET + 1 &&
            window.scrollY > 0,
        );
      });
    }

    updateToolbarState();
    window.addEventListener('scroll', updateToolbarState, { passive: true });
    window.addEventListener('resize', updateToolbarState);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', updateToolbarState);
      window.removeEventListener('resize', updateToolbarState);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (pendingAction?.type !== 'delete') {
      setConfirmDelaySeconds(0);
      return;
    }

    setConfirmDelaySeconds(3);

    const timerId = window.setInterval(() => {
      setConfirmDelaySeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [pendingAction]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedPreviewItem || pendingAction) {
        return;
      }

      if (event.key === 'Escape') {
        setSelectedPreviewIndex(-1);
      }

      if (event.key === 'ArrowLeft') {
        showPreviousPreview();
      }

      if (event.key === 'ArrowRight') {
        showNextPreview();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  async function handleAdminLogin(event) {
    event.preventDefault();

    setErrorMessage('');
    const result = await login(adminCode);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setErrorMessage('');
  }

  function showPreviousPreview() {
    setSelectedPreviewIndex((currentIndex) => {
      if (currentIndex < 0 || filteredItems.length === 0) {
        return currentIndex;
      }

      return currentIndex === 0 ? filteredItems.length - 1 : currentIndex - 1;
    });
  }

  function showNextPreview() {
    setSelectedPreviewIndex((currentIndex) => {
      if (currentIndex < 0 || filteredItems.length === 0) {
        return currentIndex;
      }

      return currentIndex === filteredItems.length - 1 ? 0 : currentIndex + 1;
    });
  }

  function toggleSelection(itemId) {
    if (!isSelectionMode) {
      return;
    }

    setSelectedIds((currentSelectedIds) => {
      const nextSelectedIds = new Set(currentSelectedIds);

      if (nextSelectedIds.has(itemId)) {
        nextSelectedIds.delete(itemId);
      } else {
        nextSelectedIds.add(itemId);
      }

      return nextSelectedIds;
    });
  }

  function toggleSelectionMode() {
    setIsSelectionMode((currentMode) => {
      const nextMode = !currentMode;

      if (!nextMode) {
        setSelectedIds(new Set());
      }

      return nextMode;
    });
  }

  function handleSelectAllFilteredItems() {
    if (!isSelectionMode) {
      return;
    }

    setSelectedIds((currentSelectedIds) => {
      const nextSelectedIds = new Set(currentSelectedIds);

      if (areAllFilteredItemsSelected) {
        filteredItems.forEach((item) => nextSelectedIds.delete(item.id));
      } else {
        filteredItems.forEach((item) => nextSelectedIds.add(item.id));
      }

      return nextSelectedIds;
    });
  }

  function requestAction({ items, scope = 'selected', type }) {
    if (!items.length || isActionWorking) {
      return;
    }

    setActionProgress(null);
    setFeedback(null);
    setErrorMessage('');

    const copy = getActionCopy(type, scope, items.length);

    setPendingAction({
      ...copy,
      items: [...items],
      scope,
      type,
    });
  }

  function closePendingAction() {
    if (isActionWorking) {
      return;
    }

    setPendingAction(null);
    setActionProgress(null);
  }

  async function confirmPendingAction() {
    if (!pendingAction || isActionWorking) {
      return;
    }

    const action = pendingAction;
    const deletedIds = [];

    setIsActionWorking(true);
    setActionProgress({
      done: 0,
      total: action.items.length,
    });

    try {
      if (action.type === 'download') {
        await downloadMediaItems(action.items, (done, total) => {
          setActionProgress({ done, total });
        });

        setFeedback({
          message: `${action.items.length} Datei(en) wurden zum Download vorbereitet.`,
          type: 'success',
        });
      } else {
        for (const [index, item] of action.items.entries()) {
          await deleteMediaItem(item);
          deletedIds.push(item.id);
          setActionProgress({
            done: index + 1,
            total: action.items.length,
          });
        }

        const deletedIdSet = new Set(deletedIds);

        setMediaItems((currentItems) =>
          currentItems.filter((item) => !deletedIdSet.has(item.id)),
        );
        setSelectedIds((currentSelectedIds) => {
          const nextSelectedIds = new Set(currentSelectedIds);
          deletedIds.forEach((id) => nextSelectedIds.delete(id));

          return nextSelectedIds;
        });
        setFeedback({
          message: `${deletedIds.length} Datei(en) wurden gelöscht.`,
          type: 'success',
        });
      }

    } catch (error) {
      if (deletedIds.length > 0) {
        const deletedIdSet = new Set(deletedIds);

        setMediaItems((currentItems) =>
          currentItems.filter((item) => !deletedIdSet.has(item.id)),
        );
      }

      setFeedback({
        message: getActionErrorMessage(action.type, error),
        type: 'error',
      });
    } finally {
      setPendingAction(null);
      setIsActionWorking(false);
      setActionProgress(null);
    }
  }

  if (isChecking) {
    return (
      <div className="gallery-loading" aria-live="polite">
        <span />
        <p>Adminzugang wird geprüft...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="content-card access-card">
        <p className="eyebrow">Adminbereich</p>
        <h1>Admin Login</h1>
        <p>Bitte gib den Admin-Code ein, um die hochgeladenen Dateien zu verwalten.</p>

        <form className="access-form" onSubmit={handleAdminLogin}>
          <label className="form-field" htmlFor="admin-code">
            Admin-Code
            <input
              id="admin-code"
              onChange={(event) => {
                setAdminCode(event.target.value);
                setErrorMessage('');
              }}
              placeholder="Admin-Code eingeben"
              type="password"
              value={adminCode}
            />
          </label>

          {errorMessage && <p className="form-error">{errorMessage}</p>}

          <button className="button-link" type="submit">
            Adminbereich öffnen
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="section-card admin-header">
        <div className="section-heading">
          <p className="eyebrow">Adminbereich</p>
          <h1>Dateien verwalten</h1>
          <p>
            Hier kannst du Uploads prüfen, ansehen, herunterladen und einzelne
            Bilder oder Videos löschen.
          </p>
        </div>
      </div>

      <div className="admin-stats-grid" aria-label="Upload-Statistiken">
        <div className="admin-stat-pair">
          <article className="admin-stat-card">
            <span>{stats.totalUploads}</span>
            <p>Anzahl Uploads</p>
          </article>
          <article className="admin-stat-card">
            <span>{formatFileSize(stats.totalBytes)}</span>
            <p>Speicherplatz</p>
          </article>
        </div>
        <div className="admin-stat-pair">
          <article className="admin-stat-card">
            <span>{stats.imageCount}</span>
            <p>Bilder</p>
          </article>
          <article className="admin-stat-card">
            <span>{stats.videoCount}</span>
            <p>Videos</p>
          </article>
        </div>
      </div>

      <label className="admin-search" htmlFor="admin-search">
        Dateien suchen
        <input
          id="admin-search"
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setSelectedPreviewIndex(-1);
          }}
          placeholder="Nach Dateiname oder Dateityp suchen"
          type="search"
          value={searchTerm}
        />
      </label>

      <div
        className={`admin-bulk-toolbar${isToolbarCompact ? ' is-compact' : ''}`}
        ref={toolbarRef}
        aria-label="Admin Sammelaktionen"
      >
        <div className="admin-bulk-actions">
          <div className="admin-bulk-primary-action">
            <button
              aria-pressed={isSelectionMode}
              aria-label={isSelectionMode ? 'Auswahl beenden' : 'Mehrere auswählen'}
              className={`secondary-button admin-icon-button admin-selection-toggle${
                isSelectionMode ? ' is-active' : ''
              }`}
              disabled={isActionWorking}
              onClick={toggleSelectionMode}
              title={isSelectionMode ? 'Auswahl beenden' : 'Mehrere auswählen'}
              type="button"
            >
              <AdminIcon name={isSelectionMode ? 'close' : 'select'} />
            </button>
          </div>

          <div className="admin-bulk-secondary-actions">
            <button
              className="secondary-button"
              disabled={filteredItems.length === 0 || isActionWorking}
              onClick={() =>
                requestAction({
                  items: filteredItems,
                  scope: 'all',
                  type: 'download',
                })
              }
              type="button"
            >
              Alle downloaden
            </button>
            {isSelectionMode && (
              <>
              <button
                className="secondary-button"
                disabled={filteredItems.length === 0 || isActionWorking}
                onClick={handleSelectAllFilteredItems}
                type="button"
              >
                {areAllFilteredItemsSelected ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
              <button
                aria-label={
                  selectedItems.length > 0
                    ? `${selectedItems.length} ausgewählte Dateien downloaden`
                    : 'Ausgewählte downloaden'
                }
                className="secondary-button admin-icon-button"
                disabled={selectedItems.length === 0 || isActionWorking}
                onClick={() =>
                  requestAction({
                    items: selectedItems,
                    scope: 'selected',
                    type: 'download',
                  })
                }
                title="Ausgewählte downloaden"
                type="button"
              >
                {selectedItems.length > 0 && (
                  <span className="admin-action-count">{selectedItems.length}</span>
                )}
                <AdminIcon name="download" />
              </button>
              <button
                aria-label="Ausgewählte löschen"
                className="danger-button admin-icon-button"
                disabled={selectedItems.length === 0 || isActionWorking}
                onClick={() =>
                  requestAction({
                    items: selectedItems,
                    scope: 'selected',
                    type: 'delete',
                  })
                }
                title="Ausgewählte löschen"
                type="button"
              >
                <AdminIcon name="trash" />
              </button>
              </>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <p className={`feedback-message is-${feedback.type}`} role="status">
          {feedback.message}
        </p>
      )}

      {errorMessage && (
        <p className="feedback-message is-error" role="alert">
          {errorMessage}
        </p>
      )}

      {isLoading && (
        <div className="gallery-loading" aria-live="polite">
          <span />
          <p>Admin-Daten werden geladen...</p>
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <div className="empty-gallery">
          <p className="eyebrow">Keine Treffer</p>
          <h2>Keine Dateien gefunden.</h2>
          <p>Ändere die Suche oder lade zuerst Dateien hoch.</p>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="admin-media-list" aria-label="Admin-Dateiliste">
          {filteredItems.map((item, index) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <article
                className={`admin-media-item${
                  isSelectionMode ? ' is-selection-mode' : ''
                }${isSelected ? ' is-selected' : ''}`}
                key={item.id}
              >
                {isSelectionMode && (
                  <label className="admin-media-select">
                    <input
                      aria-label={`${item.fileName} auswählen`}
                      checked={isSelected}
                      onChange={() => toggleSelection(item.id)}
                      type="checkbox"
                    />
                    <span className="admin-media-select-control">
                      {isSelected && <AdminIcon name="check" />}
                    </span>
                  </label>
                )}

                <button
                  aria-label={`${item.fileName} vergrößert anzeigen`}
                  className="admin-media-preview-button"
                  onClick={() => setSelectedPreviewIndex(index)}
                  type="button"
                >
                  <AdminMedia item={item} />
                </button>

                <div className="admin-media-details">
                  <span className={`status-pill is-${item.mediaKind}`}>
                    {getMediaLabel(item.mediaKind)}
                  </span>
                  <h3>{item.fileName}</h3>
                  <p>
                    {formatFileSize(item.fileSize)} · {formatUploadDate(item.uploadedAt)}
                  </p>
                </div>

                <div className="admin-media-actions">
                  <button
                    aria-label={`${item.fileName} herunterladen`}
                    className="secondary-button admin-icon-button"
                    disabled={isActionWorking}
                    onClick={() =>
                      requestAction({
                        items: [item],
                        scope: 'single',
                        type: 'download',
                      })
                    }
                    title="Herunterladen"
                    type="button"
                  >
                    <AdminIcon name="download" />
                  </button>
                  <button
                    aria-label={`${item.fileName} ${getDeleteLabel(item.mediaKind)}`}
                    className="danger-button admin-icon-button"
                    disabled={isActionWorking}
                    onClick={() =>
                      requestAction({
                        items: [item],
                        scope: 'single',
                        type: 'delete',
                      })
                    }
                    title={getDeleteLabel(item.mediaKind)}
                    type="button"
                  >
                    <AdminIcon name="trash" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedPreviewItem && (
        <div
          aria-modal="true"
          className="lightbox"
          onClick={() => setSelectedPreviewIndex(-1)}
          role="dialog"
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="Lightbox schließen"
              className="lightbox-close"
              onClick={() => setSelectedPreviewIndex(-1)}
              type="button"
            >
              ×
            </button>
            {hasLightboxNavigation && (
              <>
                <button
                  aria-label="Vorheriges Medium anzeigen"
                  className="lightbox-nav lightbox-nav-prev"
                  onClick={showPreviousPreview}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Nächstes Medium anzeigen"
                  className="lightbox-nav lightbox-nav-next"
                  onClick={showNextPreview}
                  type="button"
                >
                  ›
                </button>
              </>
            )}
            <div className="lightbox-media">
              <AdminMedia item={selectedPreviewItem} isLightbox />
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        actionProgress={actionProgress}
        confirmDelaySeconds={confirmDelaySeconds}
        isWorking={isActionWorking}
        onCancel={closePendingAction}
        onConfirm={confirmPendingAction}
        pendingAction={pendingAction}
      />
    </section>
  );
}
