import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './firebase.js';

const MEDIA_COLLECTION = 'media';
const UPLOAD_DIRECTORY = 'guest-uploads';

function createSafeFileName(fileName) {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function createUploadPath(file) {
  const timestamp = Date.now();
  const randomId =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const safeFileName = createSafeFileName(file.name);

  return `${UPLOAD_DIRECTORY}/${timestamp}-${randomId}-${safeFileName}`;
}

export function createMediaUpload(file) {
  const storagePath = createUploadPath(file);
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return {
    storagePath,
    uploadTask,
    getDownloadUrl: () => getDownloadURL(uploadTask.snapshot.ref),
  };
}

export function saveMediaMetadata({ downloadUrl, file }) {
  return addDoc(collection(db, MEDIA_COLLECTION), {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: serverTimestamp(),
    downloadUrl,
  });
}
