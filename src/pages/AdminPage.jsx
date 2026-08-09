import { useEffect, useMemo, useState } from 'react';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import {
  deleteMediaItem,
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

function matchesSearch(item, searchTerm) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  return [item.fileName, item.fileType, getMediaLabel(item.mediaKind)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
}

export default function AdminPage() {
  usePageTitle('Admin');

  const [adminCode, setAdminCode] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAuthenticated, isChecking, login } = useAdminAccess();

  const filteredItems = useMemo(
    () => mediaItems.filter((item) => matchesSearch(item, searchTerm)),
    [mediaItems, searchTerm],
  );

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

  async function handleDelete(item) {
    const mediaLabel = getMediaLabel(item.mediaKind);
    const shouldDelete = window.confirm(
      `${mediaLabel} "${item.fileName}" wirklich löschen?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(item.id);
    setFeedback(null);
    setErrorMessage('');

    try {
      await deleteMediaItem(item);
      setMediaItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setFeedback({
        message: `${item.fileName} wurde gelöscht.`,
        type: 'success',
      });
    } catch {
      setFeedback({
        message:
          'Die Datei konnte nicht gelöscht werden. Bitte prüfe Storage- und Firestore-Berechtigungen.',
        type: 'error',
      });
    } finally {
      setDeletingId('');
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
            Hier kannst du Uploads prüfen, herunterladen und einzelne Bilder
            oder Videos löschen.
          </p>
        </div>
      </div>

      <div className="admin-stats-grid" aria-label="Upload-Statistiken">
        <article className="admin-stat-card">
          <span>{stats.totalUploads}</span>
          <p>Anzahl Uploads</p>
        </article>
        <article className="admin-stat-card">
          <span>{formatFileSize(stats.totalBytes)}</span>
          <p>Speicherplatz</p>
        </article>
        <article className="admin-stat-card">
          <span>{stats.imageCount}</span>
          <p>Bilder</p>
        </article>
        <article className="admin-stat-card">
          <span>{stats.videoCount}</span>
          <p>Videos</p>
        </article>
      </div>

      <label className="admin-search" htmlFor="admin-search">
        Dateien suchen
        <input
          id="admin-search"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Nach Dateiname oder Dateityp suchen"
          type="search"
          value={searchTerm}
        />
      </label>

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
          {filteredItems.map((item) => (
            <article className="admin-media-item" key={item.id}>
              <div className="admin-media-preview">
                {item.mediaKind === 'video' ? (
                  <video muted playsInline preload="none" src={item.downloadUrl} />
                ) : (
                  <img
                    alt={item.fileName}
                    decoding="async"
                    loading="lazy"
                    sizes="8rem"
                    src={item.thumbnailUrl ?? item.downloadUrl}
                    srcSet={
                      item.thumbnailUrl
                        ? `${item.thumbnailUrl} 720w, ${item.downloadUrl} 2200w`
                        : undefined
                    }
                  />
                )}
              </div>

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
                <a
                  className="secondary-button"
                  download={item.fileName}
                  href={item.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Herunterladen
                </a>
                <button
                  className="danger-button"
                  disabled={deletingId === item.id}
                  onClick={() => handleDelete(item)}
                  type="button"
                >
                  {deletingId === item.id ? 'Löscht...' : getDeleteLabel(item.mediaKind)}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
