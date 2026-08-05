import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore';
import { db } from './firebase.js';

const MEDIA_COLLECTION = 'media';
const GALLERY_PAGE_SIZE = 12;

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

export async function getGalleryMediaPage(cursor) {
  const constraints = [
    orderBy('uploadedAt', 'desc'),
    limit(GALLERY_PAGE_SIZE),
  ];

  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor));
  }

  const mediaQuery = query(collection(db, MEDIA_COLLECTION), ...constraints);
  const snapshot = await getDocs(mediaQuery);
  const lastDocument = snapshot.docs.at(-1) ?? null;

  return {
    items: snapshot.docs.map(normalizeMediaDoc),
    cursor: lastDocument,
    hasMore: snapshot.docs.length === GALLERY_PAGE_SIZE,
  };
}
