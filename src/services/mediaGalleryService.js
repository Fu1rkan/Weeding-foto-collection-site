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
const MAX_FILTERED_PAGE_READS = 8;

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

function matchesMediaFilter(item, mediaFilter) {
  return mediaFilter === 'all' || item.mediaKind === mediaFilter;
}

export async function getGalleryMediaPage({
  cursor,
  mediaFilter = 'all',
  sortOrder = 'desc',
}) {
  let currentCursor = cursor;
  let hasMore = true;
  let readCount = 0;
  const items = [];

  while (
    items.length < GALLERY_PAGE_SIZE &&
    hasMore &&
    readCount < MAX_FILTERED_PAGE_READS
  ) {
    const constraints = [
      orderBy('uploadedAt', sortOrder),
      limit(GALLERY_PAGE_SIZE),
    ];

    if (currentCursor) {
      constraints.splice(1, 0, startAfter(currentCursor));
    }

    const mediaQuery = query(collection(db, MEDIA_COLLECTION), ...constraints);
    const snapshot = await getDocs(mediaQuery);
    const lastDocument = snapshot.docs.at(-1) ?? null;
    const matchingItems = snapshot.docs
      .map(normalizeMediaDoc)
      .filter((item) => matchesMediaFilter(item, mediaFilter));

    items.push(...matchingItems);
    currentCursor = lastDocument;
    hasMore = snapshot.docs.length === GALLERY_PAGE_SIZE;
    readCount += 1;

    if (!lastDocument) {
      hasMore = false;
    }
  }

  return {
    items,
    cursor: currentCursor,
    hasMore,
  };
}
