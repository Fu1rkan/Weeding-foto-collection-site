import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage';
import { db, storage } from './firebase.js';

const MEDIA_COLLECTION = 'media';
const UPLOAD_DIRECTORY = 'guest-uploads';
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
export const DUPLICATE_FILE_HASH_ERROR_CODE = 'media/duplicate-file';
const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';

function createSafeFileName(fileName) {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function getFileExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() ?? 'media';
}

function removeFileExtension(fileName) {
  const extensionSeparatorIndex = fileName.lastIndexOf('.');

  if (extensionSeparatorIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionSeparatorIndex);
}

function createUploadPath(file, fileHash) {
  const extension = getFileExtension(file.name);
  const safeFileName = createSafeFileName(removeFileExtension(file.name));

  return `${UPLOAD_DIRECTORY}/${fileHash}-${safeFileName}.${extension}`;
}

function createThumbnailPath(file, fileHash) {
  const safeFileName = createSafeFileName(removeFileExtension(file.name));

  return `${UPLOAD_DIRECTORY}/thumbnails/${fileHash}-${safeFileName}.webp`;
}

export function createMediaUpload(file, fileHash) {
  const storagePath = createUploadPath(file, fileHash);
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    cacheControl: CACHE_CONTROL_IMMUTABLE,
    contentType: file.type,
  });

  return {
    storagePath,
    uploadTask,
    getDownloadUrl: () => getDownloadURL(uploadTask.snapshot.ref),
  };
}

export async function uploadMediaThumbnail(file, fileHash) {
  const thumbnailPath = createThumbnailPath(file, fileHash);
  const thumbnailRef = ref(storage, thumbnailPath);
  const snapshot = await uploadBytes(thumbnailRef, file, {
    cacheControl: CACHE_CONTROL_IMMUTABLE,
    contentType: file.type,
  });

  return getDownloadURL(snapshot.ref);
}

export async function hasExistingFileHash(fileHash) {
  const mediaDoc = await getDoc(doc(db, MEDIA_COLLECTION, fileHash));

  return mediaDoc.exists();
}

export async function getGuestUploadCountLast24Hours(guestId) {
  const uploadsQuery = query(
    collection(db, MEDIA_COLLECTION),
    where('guestId', '==', guestId),
  );
  const snapshot = await getDocs(uploadsQuery);
  const since = Date.now() - ONE_DAY_IN_MS;

  return snapshot.docs.filter((docSnapshot) => {
    const uploadedAt = docSnapshot.data().uploadedAt?.toDate?.();

    return uploadedAt && uploadedAt.getTime() >= since;
  }).length;
}

export function saveMediaMetadata({
  downloadUrl,
  file,
  fileHash,
  guestId,
  thumbnailUrl,
}) {
  const mediaRef = doc(db, MEDIA_COLLECTION, fileHash);

  return runTransaction(db, async (transaction) => {
    const existingMedia = await transaction.get(mediaRef);

    if (existingMedia.exists()) {
      throw Object.assign(new Error('Duplicate file hash'), {
        code: DUPLICATE_FILE_HASH_ERROR_CODE,
      });
    }

    const metadata = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileHash,
      guestId,
      uploadedAt: serverTimestamp(),
      downloadUrl,
    };

    if (thumbnailUrl) {
      metadata.thumbnailUrl = thumbnailUrl;
    }

    transaction.set(mediaRef, metadata);
  });
}
