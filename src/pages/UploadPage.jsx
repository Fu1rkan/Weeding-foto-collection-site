import { useCallback, useEffect, useRef, useState } from 'react';
import { createMediaUpload } from '../services/mediaUploadService.js';
import {
  formatFileSize,
  getMediaType,
  isSupportedMediaFile,
} from '../utils/fileUtils.js';
import { usePageTitle } from '../hooks/usePageTitle.js';

const uploadStatusLabels = {
  queued: 'Wartet',
  uploading: 'Upload läuft',
  success: 'Hochgeladen',
  error: 'Fehler',
  canceled: 'Abgebrochen',
};

function createUploadItem(file) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${file.name}`,
    file,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    mediaType: getMediaType(file),
    message: '',
    previewUrl: URL.createObjectURL(file),
    progress: 0,
    status: 'queued',
    storagePath: '',
  };
}

function getUploadErrorMessage(error) {
  if (error.code === 'storage/canceled') {
    return 'Upload wurde abgebrochen.';
  }

  return 'Upload fehlgeschlagen. Bitte prüfe die Firebase-Konfiguration und versuche es erneut.';
}

export default function UploadPage() {
  usePageTitle('Upload');

  const [feedback, setFeedback] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const uploadTasksRef = useRef({});
  const previewUrlsRef = useRef(new Set());

  const startUpload = useCallback((item) => {
    const { storagePath, uploadTask } = createMediaUpload(item.file);

    setUploadItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              message: 'Upload wurde gestartet.',
              status: 'uploading',
              storagePath,
            }
          : currentItem,
      ),
    );

    const unsubscribe = uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );

        setUploadItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  progress,
                  status: 'uploading',
                }
              : currentItem,
          ),
        );
      },
      (error) => {
        const message = getUploadErrorMessage(error);
        const status = error.code === 'storage/canceled' ? 'canceled' : 'error';

        delete uploadTasksRef.current[item.id];

        setUploadItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  message,
                  status,
                }
              : currentItem,
          ),
        );

        setFeedback({
          message:
            status === 'canceled'
              ? `${item.fileName} wurde abgebrochen.`
              : `${item.fileName} konnte nicht hochgeladen werden.`,
          type: status === 'canceled' ? 'info' : 'error',
        });
      },
      () => {
        delete uploadTasksRef.current[item.id];

        setUploadItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  message: 'Upload erfolgreich abgeschlossen.',
                  progress: 100,
                  status: 'success',
                }
              : currentItem,
          ),
        );

        setFeedback({
          message: `${item.fileName} wurde erfolgreich hochgeladen.`,
          type: 'success',
        });
      },
    );

    uploadTasksRef.current[item.id] = {
      unsubscribe,
      uploadTask,
    };
  }, []);

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

  function handleFiles(fileList) {
    const selectedFiles = Array.from(fileList);

    if (!selectedFiles.length) {
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

    const nextItems = supportedFiles.map(createUploadItem);

    nextItems.forEach((item) => {
      previewUrlsRef.current.add(item.previewUrl);
    });

    setUploadItems((currentItems) => [...nextItems, ...currentItems]);

    setFeedback({
      message:
        unsupportedCount > 0
          ? `${supportedFiles.length} Datei(en) werden hochgeladen. ${unsupportedCount} Datei(en) wurden übersprungen.`
          : `${supportedFiles.length} Datei(en) werden hochgeladen.`,
      type: unsupportedCount > 0 ? 'info' : 'success',
    });

    nextItems.forEach(startUpload);
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
            gleichzeitig aus. Bilder und Videos werden direkt hochgeladen.
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
                  <img alt={item.fileName} src={item.previewUrl} />
                ) : (
                  <video controls muted src={item.previewUrl} />
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
