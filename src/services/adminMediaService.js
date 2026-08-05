import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
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
    uploadedAt: data.uploadedAt,
  };
}

export async function getAdminMediaItems() {
  const mediaQuery = query(
    collection(db, MEDIA_COLLECTION),
    orderBy('uploadedAt', 'desc'),
  );
  const snapshot = await getDocs(mediaQuery);

  return snapshot.docs.map(normalizeMediaDoc);
}

export async function deleteMediaItem(item) {
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

  await deleteDoc(doc(db, MEDIA_COLLECTION, item.id));
}
