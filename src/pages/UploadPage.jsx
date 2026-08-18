import { useCallback, useEffect, useState } from 'react';
import { optimizeImageForUpload } from '../services/imageCompressionService.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { calculateFileHash } from '../services/fileHashService.js';
import { ensureAnonymousSession } from '../services/firebaseAuthService.js';
import { getGuestId } from '../services/guestIdentityService.js';
import { createVideoThumbnailForUpload } from '../services/videoThumbnailService.js';
import {
  createMediaUpload,
  DUPLICATE_FILE_HASH_ERROR_CODE,
  getGuestUploadCountLast24Hours,
  hasExistingFileHash,
  saveMediaMetadata,
  uploadMediaThumbnail,
} from '../services/mediaUploadService.js';
import { getMediaType, isSupportedMediaFile } from '../utils/fileUtils.js';

const MAX_FILES_PER_UPLOAD = 40;
const MAX_GUEST_UPLOADS_PER_24_HOURS = 100;
const ACTIVE_UPLOAD_STATUSES = ['checking', 'queued', 'uploading', 'saving'];
const activeUploadTasks = {};
const uploadStoreListeners = new Set();
let uploadStoreState = {
  feedback: null,
  isPreparingUpload: false,
  selectedUploadTotal: 0,
  uploadItems: [],
};

function getUploadStoreSnapshot() {
  return uploadStoreState;
}

function setUploadStoreState(updater) {
  uploadStoreState =
    typeof updater === 'function'
      ? updater(uploadStoreState)
      : {
          ...uploadStoreState,
          ...updater,
        };

  uploadStoreListeners.forEach((listener) => {
    listener(uploadStoreState);
  });
}

function subscribeUploadStore(listener) {
  uploadStoreListeners.add(listener);

  return () => {
    uploadStoreListeners.delete(listener);
  };
}

function setFeedback(feedback) {
  setUploadStoreState({ feedback });
}

function setIsPreparingUpload(isPreparingUpload) {
  setUploadStoreState({ isPreparingUpload });
}

function setSelectedUploadTotal(selectedUploadTotal) {
  setUploadStoreState({ selectedUploadTotal });
}

function setUploadItems(updater) {
  setUploadStoreState((currentState) => ({
    ...currentState,
    uploadItems:
      typeof updater === 'function'
        ? updater(currentState.uploadItems)
        : updater,
  }));
}

function hasActiveUploadSession() {
  return (
    uploadStoreState.isPreparingUpload ||
    uploadStoreState.uploadItems.some((item) =>
      ACTIVE_UPLOAD_STATUSES.includes(item.status),
    )
  );
}

function createUploadItem(optimizedFile) {
  const { file, originalFile, thumbnailFile } = optimizedFile;

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${file.name}`,
    file,
    fileHash: '',
    fileName: file.name,
    guestId: '',
    message: '',
    originalFile,
    progress: 0,
    status: 'queued',
    storagePath: '',
    thumbnailFile,
  };
}

async function optimizeFilesForUpload(files) {
  const optimizedFiles = [];

  for (const file of files) {
    const optimizedFile = await optimizeImageForUpload(file);

    if (getMediaType(file) === 'video') {
      optimizedFiles.push({
        ...optimizedFile,
        thumbnailFile: await createVideoThumbnailForUpload(file),
      });
      continue;
    }

    optimizedFiles.push(optimizedFile);
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

  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState(getUploadStoreSnapshot);
  const { feedback, isPreparingUpload, selectedUploadTotal, uploadItems } =
    uploadState;
  const uploadedItemCount = uploadItems.filter(
    (item) => item.status === 'success',
  ).length;
  const uploadTotalCount =
    uploadItems.length > 0 ? uploadItems.length : selectedUploadTotal;
  const hasActiveUploadWork =
    isPreparingUpload ||
    uploadItems.some((item) =>
      ACTIVE_UPLOAD_STATUSES.includes(item.status),
    );
  const hasUploadProgress = isPreparingUpload || uploadTotalCount > 0;
  const uploadProgressValue =
    uploadTotalCount > 0
      ? Math.round((uploadedItemCount / uploadTotalCount) * 100)
      : 0;

  useEffect(() => subscribeUploadStore(setUploadState), []);

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

          delete activeUploadTasks[item.id];

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

          delete activeUploadTasks[item.id];
        },
      );

      activeUploadTasks[item.id] = {
        unsubscribe,
        uploadTask,
      };
    },
    [updateUploadItem],
  );

  const checkAndStartUploads = useCallback(
    async (items, guestId) => {
      const hashesInCurrentSelection = new Set();
      const currentItemIds = new Set(items.map((item) => item.id));
      const startedItemIds = new Set();
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
          startedItemIds.add(item.id);
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

      setUploadItems((currentItems) =>
        currentItems.filter(
          (item) => !currentItemIds.has(item.id) || startedItemIds.has(item.id),
        ),
      );

      if (startedCount === 0) {
        setSelectedUploadTotal(0);
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

  async function handleFiles(fileList) {
    const selectedFiles = Array.from(fileList);

    if (!selectedFiles.length) {
      return;
    }

    if (hasActiveUploadSession()) {
      setFeedback({
        message:
          'Upload läuft bereits. Bitte warte, bis der aktuelle Upload abgeschlossen ist.',
        type: 'info',
      });
      return;
    }

    setUploadItems([]);
    setIsPreparingUpload(true);
    setSelectedUploadTotal(selectedFiles.length);
    setFeedback({
      message: 'Dateien werden vorbereitet.',
      type: 'info',
    });

    if (selectedFiles.length > MAX_FILES_PER_UPLOAD) {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
      setFeedback({
        message: `Bitte wähle maximal ${MAX_FILES_PER_UPLOAD} Dateien pro Upload aus.`,
        type: 'error',
      });
      return;
    }

    const supportedFiles = selectedFiles.filter(isSupportedMediaFile);
    const unsupportedCount = selectedFiles.length - supportedFiles.length;
    setSelectedUploadTotal(supportedFiles.length);

    if (!supportedFiles.length) {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
      setFeedback({
        message: 'Bitte wähle ausschließlich Bilder oder Videos aus.',
        type: 'error',
      });
      return;
    }

    const guestId = getGuestId();
    const pendingUploadCount = uploadItems.filter((item) =>
      ACTIVE_UPLOAD_STATUSES.includes(item.status),
    ).length;

    let uploadedInLast24Hours = 0;

    try {
      await ensureAnonymousSession();
      uploadedInLast24Hours = await getGuestUploadCountLast24Hours(guestId);
    } catch (error) {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
      setFeedback({
        message: getQuotaErrorMessage(error),
        type: 'error',
      });
      return;
    }

    const remainingUploads =
      MAX_GUEST_UPLOADS_PER_24_HOURS - uploadedInLast24Hours - pendingUploadCount;

    if (remainingUploads <= 0) {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
      setFeedback({
        message: `Du hast das Limit von ${MAX_GUEST_UPLOADS_PER_24_HOURS} Dateien innerhalb von 24 Stunden erreicht.`,
        type: 'error',
      });
      return;
    }

    if (supportedFiles.length > remainingUploads) {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
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

    let optimizedFiles = [];

    try {
      optimizedFiles = await optimizeFilesForUpload(supportedFiles);
    } catch {
      setIsPreparingUpload(false);
      setSelectedUploadTotal(0);
      setFeedback({
        message:
          'Die Dateien konnten nicht vorbereitet werden. Bitte versuche es erneut.',
        type: 'error',
      });
      return;
    }

    const compressedCount = optimizedFiles.filter(
      (optimizedFile) => optimizedFile.wasCompressed,
    ).length;
    const nextItems = optimizedFiles.map(createUploadItem);

    setUploadItems((currentItems) => [...nextItems, ...currentItems]);
    setIsPreparingUpload(false);
    setSelectedUploadTotal(0);

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

    if (hasActiveUploadWork) {
      return;
    }

    setIsDragging(true);
  }

  function handleDropzoneClick(event) {
    if (!hasActiveUploadWork) {
      return;
    }

    event.preventDefault();
    setFeedback({
      message:
        'Upload läuft bereits. Bitte warte, bis der aktuelle Upload abgeschlossen ist.',
      type: 'info',
    });
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);

    if (hasActiveUploadWork) {
      setFeedback({
        message:
          'Upload läuft bereits. Bitte warte, bis der aktuelle Upload abgeschlossen ist.',
        type: 'info',
      });
      return;
    }

    handleFiles(event.dataTransfer.files);
  }

  return (
    <section className={`upload-page${hasUploadProgress ? ' has-upload-items' : ''}`}>
      <div className="section-grid upload-intro">
        <div className="section-intro">
          <p className="eyebrow">Upload</p>
          <h1>Fotos und Videos hochladen</h1>
          <p>max. 40 Dateien.</p>
        </div>

        <label
          aria-disabled={hasActiveUploadWork}
          className={`dropzone${isDragging ? ' is-dragging' : ''}${
            hasActiveUploadWork ? ' is-disabled' : ''
          }`}
          htmlFor="media-upload"
          onClick={handleDropzoneClick}
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
            disabled={hasActiveUploadWork}
            type="file"
          />
          <span aria-hidden="true" className="dropzone-icon" />
          <strong>
            {hasActiveUploadWork ? 'Upload läuft gerade' : 'Dateien hier ablegen'}
          </strong>
          <p>
            {hasActiveUploadWork
              ? 'Bitte warte, bis der aktuelle Upload abgeschlossen ist.'
              : 'oder klicken, um Bilder und Videos auszuwählen'}
          </p>
        </label>
      </div>

      {feedback && (
        <p className={`feedback-message is-${feedback.type}`} role="status">
          {feedback.message}
        </p>
      )}

      {hasUploadProgress && (
        <div
          aria-busy={hasActiveUploadWork}
          aria-live="polite"
          className={`upload-progress-summary${hasActiveUploadWork ? ' is-active' : ''}`}
        >
          {hasActiveUploadWork && (
            <span aria-hidden="true" className="upload-progress-spinner" />
          )}

          <p>
            {uploadTotalCount === 0 ? (
              'Dateien werden vorbereitet...'
            ) : (
              <>
                <span className="upload-progress-count">{uploadedItemCount}</span>{' '}
                von{' '}
                <span className="upload-progress-count">
                  {uploadTotalCount}
                </span>{' '}
                wurden hochgeladen
              </>
            )}
          </p>

          <div
            aria-label="Upload-Fortschritt"
            aria-valuemax="100"
            aria-valuemin="0"
            aria-valuenow={uploadProgressValue}
            className="upload-total-progress"
            role="progressbar"
          >
            <span style={{ width: `${uploadProgressValue}%` }} />
          </div>

          <small>
            {isPreparingUpload
              ? 'Bitte kurz warten.'
              : `${uploadProgressValue}% abgeschlossen`}
          </small>
        </div>
      )}
    </section>
  );
}
