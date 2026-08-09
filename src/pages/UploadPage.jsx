import { useCallback, useEffect, useRef, useState } from 'react';
import { optimizeImageForUpload } from '../services/imageCompressionService.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { calculateFileHash } from '../services/fileHashService.js';
import { ensureAnonymousSession } from '../services/firebaseAuthService.js';
import { getGuestId } from '../services/guestIdentityService.js';
import {
  createMediaUpload,
  DUPLICATE_FILE_HASH_ERROR_CODE,
  getGuestUploadCountLast24Hours,
  hasExistingFileHash,
  saveMediaMetadata,
  uploadMediaThumbnail,
} from '../services/mediaUploadService.js';
import {
  formatFileSize,
  getMediaType,
  isSupportedMediaFile,
} from '../utils/fileUtils.js';

const MAX_FILES_PER_UPLOAD = 20;
const MAX_GUEST_UPLOADS_PER_24_HOURS = 100;

const uploadStatusLabels = {
  queued: 'Wartet',
  checking: 'Prüft Datei',
  uploading: 'Upload läuft',
  saving: 'Speichert Daten',
  success: 'Hochgeladen',
  error: 'Fehler',
  blocked: 'Blockiert',
  canceled: 'Abgebrochen',
};

function createUploadItem(optimizedFile) {
  const { file, originalFile, thumbnailFile, wasCompressed } = optimizedFile;
  const compressionMessage = wasCompressed
    ? `Bild wurde für schnelleren Upload komprimiert: ${formatFileSize(
        originalFile.size,
      )} → ${formatFileSize(file.size)}.`
    : '';

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${file.name}`,
    compressionMessage,
    file,
    fileHash: '',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    guestId: '',
    mediaType: getMediaType(file),
    message: '',
    originalFile,
    previewUrl: URL.createObjectURL(file),
    progress: 0,
    status: 'queued',
    storagePath: '',
    thumbnailFile,
    wasCompressed,
  };
}

async function optimizeFilesForUpload(files) {
  const optimizedFiles = [];

  for (const file of files) {
    optimizedFiles.push(await optimizeImageForUpload(file));
  }

  return optimizedFiles;
}

function getUploadErrorMessage(error) {
  if (error.code === 'storage/canceled') {
    return 'Upload wurde abgebrochen.';
  }

  if (error.code === 'storage/unauthorized') {
    return 'Upload wurde blockiert. Bitte prüfe Dateityp, Dateigröße und Upload-Regeln.';
  }

  return 'Upload fehlgeschlagen. Bitte prüfe die Firebase-Konfiguration und versuche es erneut.';
}

function getMetadataErrorMessage(error) {
  if (error.code === DUPLICATE_FILE_HASH_ERROR_CODE) {
    return 'Diese Datei wurde bereits hochgeladen und wird nicht erneut gespeichert.';
  }

  return 'Datei wurde hochgeladen, aber die Informationen konnten nicht in Firestore gespeichert werden.';
}

function getQuotaErrorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Das Upload-Kontingent konnte nicht geprüft werden. Bitte melde dich erneut über den Gästecode an. Falls das erneut passiert, müssen die Firebase-Regeln veröffentlicht werden.';
  }

  return 'Das Upload-Kontingent konnte nicht geprüft werden. Bitte lade die Seite neu oder melde dich erneut über den Gästecode an.';
}

export default function UploadPage() {
  usePageTitle('Upload');

  const [feedback, setFeedback] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const uploadTasksRef = useRef({});
  const previewUrlsRef = useRef(new Set());

  const updateUploadItem = useCallback((itemId, updates) => {
    setUploadItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === itemId
          ? {
              ...currentItem,
              ...updates,
            }
          : currentItem,
      ),
    );
  }, []);

  const startUpload = useCallback(
    async (item) => {
      let mediaUpload;

      try {
        mediaUpload = await createMediaUpload(item.file, item.fileHash);
      } catch {
        updateUploadItem(item.id, {
          message:
            'Firebase konnte den Gästezugang nicht vorbereiten. Bitte lade die Seite neu oder melde dich erneut an.',
          status: 'error',
        });

        setFeedback({
          message: `${item.fileName} konnte nicht hochgeladen werden, weil der Gästezugang nicht bereit ist.`,
          type: 'error',
        });
        return;
      }

      const { getDownloadUrl, storagePath, uploadTask } = mediaUpload;

      updateUploadItem(item.id, {
        message: 'Upload wurde gestartet.',
        status: 'uploading',
        storagePath,
      });

      const unsubscribe = uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );

          updateUploadItem(item.id, {
            progress,
            status: 'uploading',
          });
        },
        (error) => {
          const message = getUploadErrorMessage(error);
          const status = error.code === 'storage/canceled' ? 'canceled' : 'error';

          delete uploadTasksRef.current[item.id];

          updateUploadItem(item.id, {
            message,
            status,
          });

          setFeedback({
            message:
              status === 'canceled'
                ? `${item.fileName} wurde abgebrochen.`
                : `${item.fileName} konnte nicht hochgeladen werden.`,
            type: status === 'canceled' ? 'info' : 'error',
          });
        },
        async () => {
          updateUploadItem(item.id, {
            message: 'Upload abgeschlossen. Informationen werden gespeichert.',
            progress: 100,
            status: 'saving',
          });

          try {
            const downloadUrl = await getDownloadUrl();
            let thumbnailUrl = '';

            if (item.thumbnailFile) {
              updateUploadItem(item.id, {
                message:
                  'Upload abgeschlossen. Optimierte Vorschau wird gespeichert.',
                progress: 100,
                status: 'saving',
              });

              try {
                thumbnailUrl = await uploadMediaThumbnail(
                  item.thumbnailFile,
                  item.fileHash,
                );
              } catch {
                thumbnailUrl = '';
              }
            }

            await saveMediaMetadata({
              downloadUrl,
              file: item.file,
              fileHash: item.fileHash,
              guestId: item.guestId,
              thumbnailUrl,
            });

            updateUploadItem(item.id, {
              message: 'Upload und Speicherung erfolgreich abgeschlossen.',
              progress: 100,
              status: 'success',
            });

            setFeedback({
              message: `${item.fileName} wurde erfolgreich hochgeladen und gespeichert.`,
              type: 'success',
            });
          } catch (error) {
            updateUploadItem(item.id, {
              message: getMetadataErrorMessage(error),
              progress: 100,
              status: 'error',
            });

            setFeedback({
              message:
                error.code === DUPLICATE_FILE_HASH_ERROR_CODE
                  ? `${item.fileName} wurde bereits hochgeladen und nicht erneut gespeichert.`
                  : `${item.fileName} wurde hochgeladen, aber nicht in Firestore gespeichert.`,
              type: 'error',
            });
          }

          delete uploadTasksRef.current[item.id];
        },
      );

      uploadTasksRef.current[item.id] = {
        unsubscribe,
        uploadTask,
      };
    },
    [updateUploadItem],
  );

  const checkAndStartUploads = useCallback(
    async (items, guestId) => {
      const hashesInCurrentSelection = new Set();
      let blockedCount = 0;
      let startedCount = 0;

      for (const item of items) {
        updateUploadItem(item.id, {
          message: 'Datei wird geprüft und Hash wird berechnet.',
          status: 'checking',
        });

        try {
          const fileHash = await calculateFileHash(item.originalFile);

          if (hashesInCurrentSelection.has(fileHash)) {
            blockedCount += 1;
            updateUploadItem(item.id, {
              fileHash,
              message:
                'Diese Datei ist bereits in deiner aktuellen Auswahl enthalten und wird nicht erneut hochgeladen.',
              status: 'blocked',
            });
            continue;
          }

          hashesInCurrentSelection.add(fileHash);

          if (await hasExistingFileHash(fileHash)) {
            blockedCount += 1;
            updateUploadItem(item.id, {
              fileHash,
              message:
                'Diese Datei wurde bereits hochgeladen und wird nicht erneut gespeichert.',
              status: 'blocked',
            });
            continue;
          }

          const preparedItem = {
            ...item,
            fileHash,
            guestId,
          };

          updateUploadItem(item.id, {
            fileHash,
            guestId,
            message: 'Prüfung erfolgreich. Upload startet gleich.',
            status: 'queued',
          });

          startedCount += 1;
          void startUpload(preparedItem);
        } catch {
          blockedCount += 1;
          updateUploadItem(item.id, {
            message:
              'Diese Datei konnte nicht geprüft werden. Bitte versuche es erneut.',
            status: 'error',
          });
        }
      }

      if (startedCount === 0) {
        setFeedback({
          message:
            blockedCount > 0
              ? 'Es wurde keine Datei hochgeladen, weil alle Dateien blockiert wurden.'
              : 'Es wurde keine Datei hochgeladen.',
          type: 'error',
        });
        return;
      }

      setFeedback({
        message:
          blockedCount > 0
            ? `${startedCount} Datei(en) werden hochgeladen. ${blockedCount} Datei(en) wurden blockiert.`
            : `${startedCount} Datei(en) werden hochgeladen.`,
        type: blockedCount > 0 ? 'info' : 'success',
      });
    },
    [startUpload, updateUploadItem],
  );

  useEffect(() => {
    return () => {
      Object.values(uploadTasksRef.current).forEach(({ unsubscribe }) => {
        unsubscribe();
      });

      previewUrlsRef.current.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
    };
  }, []);

  async function handleFiles(fileList) {
    const selectedFiles = Array.from(fileList);

    if (!selectedFiles.length) {
      return;
    }

    if (selectedFiles.length > MAX_FILES_PER_UPLOAD) {
      setFeedback({
        message: `Bitte wähle maximal ${MAX_FILES_PER_UPLOAD} Dateien pro Upload aus.`,
        type: 'error',
      });
      return;
    }

    const supportedFiles = selectedFiles.filter(isSupportedMediaFile);
    const unsupportedCount = selectedFiles.length - supportedFiles.length;

    if (!supportedFiles.length) {
      setFeedback({
        message: 'Bitte wähle ausschließlich Bilder oder Videos aus.',
        type: 'error',
      });
      return;
    }

    const guestId = getGuestId();
    const pendingUploadCount = uploadItems.filter((item) =>
      ['checking', 'queued', 'uploading', 'saving'].includes(item.status),
    ).length;

    let uploadedInLast24Hours = 0;

    try {
      await ensureAnonymousSession();
      uploadedInLast24Hours = await getGuestUploadCountLast24Hours(guestId);
    } catch (error) {
      setFeedback({
        message: getQuotaErrorMessage(error),
        type: 'error',
      });
      return;
    }

    const remainingUploads =
      MAX_GUEST_UPLOADS_PER_24_HOURS - uploadedInLast24Hours - pendingUploadCount;

    if (remainingUploads <= 0) {
      setFeedback({
        message: `Du hast das Limit von ${MAX_GUEST_UPLOADS_PER_24_HOURS} Dateien innerhalb von 24 Stunden erreicht.`,
        type: 'error',
      });
      return;
    }

    if (supportedFiles.length > remainingUploads) {
      setFeedback({
        message: `Du kannst aktuell noch ${remainingUploads} Datei(en) hochladen. Bitte wähle weniger Dateien aus.`,
        type: 'error',
      });
      return;
    }

    setFeedback({
      message: 'Dateien werden für schnelleren Upload vorbereitet.',
      type: 'info',
    });

    const optimizedFiles = await optimizeFilesForUpload(supportedFiles);
    const compressedCount = optimizedFiles.filter(
      (optimizedFile) => optimizedFile.wasCompressed,
    ).length;
    const nextItems = optimizedFiles.map(createUploadItem);

    nextItems.forEach((item) => {
      previewUrlsRef.current.add(item.previewUrl);
    });

    setUploadItems((currentItems) => [...nextItems, ...currentItems]);

    setFeedback({
      message:
        unsupportedCount > 0
          ? `${supportedFiles.length} Datei(en) werden geprüft. ${unsupportedCount} Datei(en) wurden übersprungen.`
          : compressedCount > 0
            ? `${supportedFiles.length} Datei(en) werden geprüft. ${compressedCount} Bild(er) wurden komprimiert.`
            : `${supportedFiles.length} Datei(en) werden geprüft.`,
      type: 'info',
    });

    checkAndStartUploads(nextItems, guestId);
  }

  function handleInputChange(event) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleCancelUpload(itemId) {
    uploadTasksRef.current[itemId]?.uploadTask.cancel();
  }

  return (
    <section className="upload-page">
      <div className="section-grid upload-intro">
        <div className="section-intro">
          <p className="eyebrow">Upload</p>
          <h1>Fotos und Videos hochladen</h1>
          <p>
            Zieht eure Erinnerungen direkt hierher oder wählt mehrere Dateien
            gleichzeitig aus. Pro Upload sind maximal 20 Dateien möglich.
          </p>
        </div>

        <label
          className={`dropzone${isDragging ? ' is-dragging' : ''}`}
          htmlFor="media-upload"
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            accept="image/*,video/*"
            className="dropzone-input"
            id="media-upload"
            multiple
            onChange={handleInputChange}
            type="file"
          />
          <span className="dropzone-icon">+</span>
          <strong>Dateien hier ablegen</strong>
          <p>oder klicken, um Bilder und Videos auszuwählen</p>
        </label>
      </div>

      {feedback && (
        <p className={`feedback-message is-${feedback.type}`} role="status">
          {feedback.message}
        </p>
      )}

      {uploadItems.length > 0 && (
        <div className="upload-list" aria-label="Ausgewählte Uploads">
          {uploadItems.map((item) => (
            <article className="upload-item" key={item.id}>
              <div className="upload-preview">
                {item.mediaType === 'image' ? (
                  <img
                    alt={item.fileName}
                    decoding="async"
                    loading="lazy"
                    src={item.previewUrl}
                  />
                ) : (
                  <video controls muted preload="metadata" src={item.previewUrl} />
                )}
              </div>

              <div className="upload-details">
                <div className="upload-title-row">
                  <div>
                    <h3>{item.fileName}</h3>
                    <p>
                      {item.mediaType === 'image' ? 'Bild' : 'Video'} ·{' '}
                      {item.fileSize}
                    </p>
                  </div>
                  <span className={`status-pill is-${item.status}`}>
                    {uploadStatusLabels[item.status]}
                  </span>
                </div>

                <div className="progress-row">
                  <progress max="100" value={item.progress}>
                    {item.progress}%
                  </progress>
                  <span>{item.progress}%</span>
                </div>

                {item.compressionMessage && (
                  <p className="upload-meta-note">{item.compressionMessage}</p>
                )}

                {item.message && (
                  <p className={`upload-message is-${item.status}`}>
                    {item.message}
                  </p>
                )}

                {item.status === 'uploading' && (
                  <button
                    className="secondary-button"
                    onClick={() => handleCancelUpload(item.id)}
                    type="button"
                  >
                    Upload abbrechen
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
