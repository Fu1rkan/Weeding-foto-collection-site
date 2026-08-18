import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getMetadata, ref, uploadBytes } from 'firebase/storage';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-hochzeitswebseite-rules';
const STORAGE_BUCKET = `gs://${PROJECT_ID}.appspot.com`;
const IMAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 4 * 1024 * 1024 * 1024;
const THUMBNAIL_LIMIT_BYTES = 2 * 1024 * 1024;
const VALID_HASH = 'a'.repeat(64);

let testEnv;

function mediaData(overrides = {}) {
  return {
    fileName: 'photo.jpg',
    fileType: 'image/jpeg',
    fileSize: 1024,
    fileHash: VALID_HASH,
    guestId: 'guest-user',
    uploadedAt: serverTimestamp(),
    downloadUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

function storageFile(context, path) {
  return ref(context.storage(STORAGE_BUCKET), path);
}

function createBlob(contentType, size = 32) {
  return new Blob([new Uint8Array(size)], { type: contentType });
}

async function createAdminRecord(uid = 'admin-user') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `admins/${uid}`), {
      createdAt: serverTimestamp(),
    });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

after(async () => {
  await testEnv.cleanup();
});

describe('Firestore media rules', () => {
  it('allows guests to create valid media metadata', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertSucceeds(
      setDoc(doc(guest.firestore(), `media/${VALID_HASH}`), mediaData()),
    );
  });

  it('allows optimized image metadata with a thumbnail URL', async () => {
    const guest = testEnv.authenticatedContext('guest-user');
    const fileHash = 'b'.repeat(64);

    await assertSucceeds(
      setDoc(
        doc(guest.firestore(), `media/${fileHash}`),
        mediaData({
          fileHash,
          fileName: 'photo.webp',
          fileType: 'image/webp',
          thumbnailUrl: 'https://example.com/photo-thumbnail.webp',
        }),
      ),
    );
  });

  it('allows video metadata up to 4 GB and blocks larger videos', async () => {
    const guest = testEnv.authenticatedContext('guest-user');
    const videoHash = 'c'.repeat(64);
    const oversizedVideoHash = 'd'.repeat(64);

    await assertSucceeds(
      setDoc(
        doc(guest.firestore(), `media/${videoHash}`),
        mediaData({
          fileHash: videoHash,
          fileName: 'video.mp4',
          fileType: 'video/mp4',
          fileSize: VIDEO_LIMIT_BYTES,
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(guest.firestore(), `media/${oversizedVideoHash}`),
        mediaData({
          fileHash: oversizedVideoHash,
          fileName: 'video.mp4',
          fileType: 'video/mp4',
          fileSize: VIDEO_LIMIT_BYTES + 1,
        }),
      ),
    );
  });

  it('blocks unauthenticated metadata creates', async () => {
    const visitor = testEnv.unauthenticatedContext();

    await assertFails(
      setDoc(doc(visitor.firestore(), `media/${VALID_HASH}`), mediaData()),
    );
  });

  it('blocks invalid file types and oversized image metadata', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertFails(
      setDoc(
        doc(guest.firestore(), `media/${VALID_HASH}`),
        mediaData({
          fileName: 'malware.exe',
          fileType: 'application/x-msdownload',
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(guest.firestore(), `media/${VALID_HASH}`),
        mediaData({
          fileSize: IMAGE_LIMIT_BYTES + 1,
        }),
      ),
    );
  });

  it('blocks duplicate metadata documents with the same hash for guests', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `media/${VALID_HASH}`), mediaData());
    });

    const guest = testEnv.authenticatedContext('guest-user');

    await assertFails(
      setDoc(doc(guest.firestore(), `media/${VALID_HASH}`), mediaData()),
    );
  });

  it('allows guest reads but blocks guest updates and deletes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'media/existing'), mediaData());
    });

    const guest = testEnv.authenticatedContext('guest-user');

    await assertSucceeds(getDoc(doc(guest.firestore(), 'media/existing')));
    await assertSucceeds(getDocs(collection(guest.firestore(), 'media')));
    await assertFails(
      updateDoc(doc(guest.firestore(), 'media/existing'), {
        fileName: 'changed.jpg',
      }),
    );
    await assertFails(deleteDoc(doc(guest.firestore(), 'media/existing')));
  });

  it('allows admins to update and delete metadata', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'media/existing'), mediaData());
    });
    await createAdminRecord();

    const admin = testEnv.authenticatedContext('admin-user');

    await assertSucceeds(
      updateDoc(doc(admin.firestore(), 'media/existing'), {
        reviewed: true,
      }),
    );
    await assertSucceeds(deleteDoc(doc(admin.firestore(), 'media/existing')));
  });
});

describe('Storage guest upload rules', () => {
  it('allows guests to upload and read supported images and videos in guest-uploads', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertSucceeds(
      uploadBytes(
        storageFile(guest, 'guest-uploads/photo.jpg'),
        createBlob('image/jpeg'),
      ),
    );
    await assertSucceeds(getMetadata(storageFile(guest, 'guest-uploads/photo.jpg')));

    await assertSucceeds(
      uploadBytes(
        storageFile(guest, 'guest-uploads/video.mp4'),
        createBlob('video/mp4'),
      ),
    );
    await assertSucceeds(getMetadata(storageFile(guest, 'guest-uploads/video.mp4')));
  });

  it('allows guests to upload optimized image thumbnails', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertSucceeds(
      uploadBytes(
        storageFile(guest, 'guest-uploads/thumbnails/photo-thumbnail.webp'),
        createBlob('image/webp'),
      ),
    );
    await assertSucceeds(
      getMetadata(storageFile(guest, 'guest-uploads/thumbnails/photo-thumbnail.webp')),
    );
  });

  it('blocks oversized optimized image thumbnails', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertFails(
      uploadBytes(
        storageFile(guest, 'guest-uploads/thumbnails/too-large-thumbnail.webp'),
        createBlob('image/webp', THUMBNAIL_LIMIT_BYTES + 1),
      ),
    );
  });

  it('blocks unauthenticated uploads and uploads outside guest-uploads', async () => {
    const visitor = testEnv.unauthenticatedContext();
    const guest = testEnv.authenticatedContext('guest-user');

    await assertFails(
      uploadBytes(
        storageFile(visitor, 'guest-uploads/photo.jpg'),
        createBlob('image/jpeg'),
      ),
    );
    await assertFails(
      uploadBytes(storageFile(guest, 'other-folder/photo.jpg'), createBlob('image/jpeg')),
    );
  });

  it('blocks unsupported file extensions and content types', async () => {
    const guest = testEnv.authenticatedContext('guest-user');

    await assertFails(
      uploadBytes(
        storageFile(guest, 'guest-uploads/document.pdf'),
        createBlob('application/pdf'),
      ),
    );
    await assertFails(
      uploadBytes(
        storageFile(guest, 'guest-uploads/photo.jpg'),
        createBlob('application/pdf'),
      ),
    );
  });

  it(
    'blocks images larger than 50 MB',
    { timeout: 120000 },
    async () => {
      const guest = testEnv.authenticatedContext('guest-user');

      await assertFails(
        uploadBytes(
          storageFile(guest, 'guest-uploads/too-large.jpg'),
          createBlob('image/jpeg', IMAGE_LIMIT_BYTES + 1),
        ),
      );
    },
  );

  it('blocks guest deletes but allows admin deletes', async () => {
    const guest = testEnv.authenticatedContext('guest-user');
    const admin = testEnv.authenticatedContext('admin-user');
    const fileRef = storageFile(guest, 'guest-uploads/photo.jpg');

    await createAdminRecord();
    await assertSucceeds(uploadBytes(fileRef, createBlob('image/jpeg')));
    await assertFails(deleteObject(fileRef));
    await assertSucceeds(deleteObject(storageFile(admin, 'guest-uploads/photo.jpg')));
  });
});
