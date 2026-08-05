const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAIN_IMAGE_MAX_DIMENSION = 2200;
const THUMBNAIL_MAX_DIMENSION = 720;
const MAIN_IMAGE_QUALITY = 0.82;
const THUMBNAIL_QUALITY = 0.72;
const MIN_COMPRESSION_SIZE = 420 * 1024;

function canCompressImage(file) {
  return COMPRESSIBLE_IMAGE_TYPES.has(file.type);
}

function getImageDimensions(imageSource) {
  return {
    height: imageSource.height || imageSource.naturalHeight,
    width: imageSource.width || imageSource.naturalWidth,
  };
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

function getFileNameWithoutExtension(fileName) {
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionIndex);
}

function createWebpFileName(fileName, suffix = '') {
  return `${getFileNameWithoutExtension(fileName)}${suffix}.webp`;
}

function createImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image could not be loaded.'));
    };
    image.src = objectUrl;
  });
}

function loadImageSource(file) {
  if ('createImageBitmap' in globalThis) {
    return createImageBitmap(file);
  }

  return createImageElement(file);
}

function createCanvas({ height, width }) {
  if ('OffscreenCanvas' in globalThis) {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function canvasToBlob(canvas, quality) {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({
      quality,
      type: 'image/webp',
    });
  }

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

async function renderImageVariant({
  file,
  imageSource,
  maxDimension,
  quality,
  suffix,
}) {
  const sourceDimensions = getImageDimensions(imageSource);
  const targetDimensions = getTargetDimensions({
    ...sourceDimensions,
    maxDimension,
  });

  if (!targetDimensions.height || !targetDimensions.width) {
    return null;
  }

  const canvas = createCanvas(targetDimensions);
  const context = canvas.getContext('2d', {
    alpha: true,
    desynchronized: true,
  });

  if (!context) {
    return null;
  }

  context.drawImage(imageSource, 0, 0, targetDimensions.width, targetDimensions.height);

  const blob = await canvasToBlob(canvas, quality);

  if (!blob || blob.type !== 'image/webp') {
    return null;
  }

  return new File([blob], createWebpFileName(file.name, suffix), {
    lastModified: file.lastModified,
    type: 'image/webp',
  });
}

export async function optimizeImageForUpload(file) {
  if (!canCompressImage(file)) {
    return {
      file,
      originalFile: file,
      thumbnailFile: null,
      wasCompressed: false,
    };
  }

  let imageSource;

  try {
    imageSource = await loadImageSource(file);

    const shouldCompressMainImage = file.size >= MIN_COMPRESSION_SIZE;
    const optimizedFile = shouldCompressMainImage
      ? await renderImageVariant({
          file,
          imageSource,
          maxDimension: MAIN_IMAGE_MAX_DIMENSION,
          quality: MAIN_IMAGE_QUALITY,
          suffix: '',
        })
      : null;
    const thumbnailFile = await renderImageVariant({
      file,
      imageSource,
      maxDimension: THUMBNAIL_MAX_DIMENSION,
      quality: THUMBNAIL_QUALITY,
      suffix: '-thumbnail',
    });
    const uploadFile =
      optimizedFile && optimizedFile.size < file.size ? optimizedFile : file;
    const uploadThumbnail =
      thumbnailFile && thumbnailFile.size < uploadFile.size ? thumbnailFile : null;

    return {
      file: uploadFile,
      originalFile: file,
      thumbnailFile: uploadThumbnail,
      wasCompressed: uploadFile !== file,
    };
  } catch {
    return {
      file,
      originalFile: file,
      thumbnailFile: null,
      wasCompressed: false,
    };
  } finally {
    imageSource?.close?.();
  }
}
