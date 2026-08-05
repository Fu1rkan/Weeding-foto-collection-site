import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase.js';

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
  };
}
