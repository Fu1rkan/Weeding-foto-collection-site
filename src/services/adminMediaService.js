import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { deleteObject, getBlob, ref } from 'firebase/storage';
import { ensureAdminSession } from './adminAccessService.js';
import { db, storage } from './firebase.js';

const MEDIA_COLLECTION = 'media';

function getMediaKind(fileType) {
  if (fileType?.startsWith('image/')) {
    return 'image';
  }

  if (fileType?.startsWith('video/')) {
    return 'video';
  }

  return 'unknown';
}

function normalizeMediaDoc(docSnapshot) {
  const data = docSnapshot.data();

  return {
    id: docSnapshot.id,
    downloadUrl: data.downloadUrl,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileType: data.fileType,
    mediaKind: getMediaKind(data.fileType),
    thumbnailUrl: data.thumbnailUrl,
    uploadedAt: data.uploadedAt,
  };
}

function triggerBrowserDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName || 'hochzeit-download';
  link.style.display = 'none';

  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function waitBetweenDownloads() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 250);
  });
}

export async function getAdminMediaItems() {
  await ensureAdminSession();

  const mediaQuery = query(
    collection(db, MEDIA_COLLECTION),
    orderBy('uploadedAt', 'desc'),
  );
  const snapshot = await getDocs(mediaQuery);

  return snapshot.docs.map(normalizeMediaDoc);
}

export async function deleteMediaItem(item) {
  await ensureAdminSession();

  if (item.downloadUrl) {
    const storageRef = ref(storage, item.downloadUrl);

    try {
      await deleteObject(storageRef);
    } catch (error) {
      if (error.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  }

  if (item.thumbnailUrl) {
    const thumbnailRef = ref(storage, item.thumbnailUrl);

    try {
      await deleteObject(thumbnailRef);
    } catch (error) {
      if (error.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  }

  await deleteDoc(doc(db, MEDIA_COLLECTION, item.id));
}

export async function downloadMediaItem(item) {
  await ensureAdminSession();

  const storageRef = ref(storage, item.downloadUrl);
  const blob = await getBlob(storageRef);

  triggerBrowserDownload(blob, item.fileName);
}

export async function downloadMediaItems(items, onProgress) {
  for (const [index, item] of items.entries()) {
    await downloadMediaItem(item);
    onProgress?.(index + 1, items.length);

    if (index < items.length - 1) {
      await waitBetweenDownloads();
    }
  }
}
