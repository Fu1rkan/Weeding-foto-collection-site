const VIDEO_COVER_CAPTURE_TIME_SECONDS = 1;
const VIDEO_COVER_MAX_DIMENSION = 720;
const VIDEO_COVER_QUALITY = 0.72;

function getFileNameWithoutExtension(fileName) {
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionIndex);
}

function createVideoCoverFileName(fileName) {
  return `${getFileNameWithoutExtension(fileName)}-cover.webp`;
}

function getTargetDimensions({ height, maxDimension, width }) {
  if (!height || !width) {
    return {
      height: 0,
      width: 0,
    };
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    height: Math.round(height * scale),
    width: Math.round(width * scale),
  };
}

function createCanvas({ height, width }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

function getVideoCaptureTime(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return Math.min(VIDEO_COVER_CAPTURE_TIME_SECONDS, Math.max(0, duration - 0.05));
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`${eventName} failed.`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, handleSuccess);
      target.removeEventListener('error', handleError);
    };

    target.addEventListener(eventName, handleSuccess, { once: true });
    target.addEventListener('error', handleError, { once: true });
  });
}

function createVideoElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.addEventListener(
      'loadedmetadata',
      () => {
        resolve({ objectUrl, video });
      },
      { once: true },
    );
    video.addEventListener(
      'error',
      () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Video could not be loaded.'));
      },
      { once: true },
    );

    video.src = objectUrl;
    video.load();
  });
}

async function seekVideo(video, time) {
  if (time <= 0) {
    if (video.readyState < 2) {
      await waitForEvent(video, 'loadeddata');
    }
    return;
  }

  const seekedPromise = waitForEvent(video, 'seeked');
  video.currentTime = time;
  await seekedPromise;
}

export async function createVideoThumbnailForUpload(file) {
  if (!file.type.startsWith('video/')) {
    return null;
  }

  let objectUrl = '';

  try {
    const loadedVideo = await createVideoElement(file);
    const { video } = loadedVideo;
    objectUrl = loadedVideo.objectUrl;

    await seekVideo(video, getVideoCaptureTime(video.duration));

    const targetDimensions = getTargetDimensions({
      height: video.videoHeight,
      maxDimension: VIDEO_COVER_MAX_DIMENSION,
      width: video.videoWidth,
    });

    if (!targetDimensions.height || !targetDimensions.width) {
      return null;
    }

    const canvas = createCanvas(targetDimensions);
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, targetDimensions.width, targetDimensions.height);

    const blob = await canvasToBlob(canvas, VIDEO_COVER_QUALITY);

    if (!blob || blob.type !== 'image/webp') {
      return null;
    }

    return new File([blob], createVideoCoverFileName(file.name), {
      lastModified: file.lastModified,
      type: 'image/webp',
    });
  } catch {
    return null;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
