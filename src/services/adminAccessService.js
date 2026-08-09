import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const ADMIN_ACCESS_STORAGE_KEY = 'weddingAdminAccessGranted';
const ADMIN_COLLECTION = 'admins';
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;

function grantAdminAccess() {
  window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, 'true');
}

function revokeAdminAccess() {
  window.localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY);
}

export function hasStoredAdminAccess() {
  return window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === 'true';
}

export async function hasFirebaseAdminAccess(user = auth.currentUser) {
  if (!user) {
    return false;
  }

  const adminDoc = await getDoc(doc(db, ADMIN_COLLECTION, user.uid));

  return adminDoc.exists();
}

export function subscribeToAdminAccess(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      revokeAdminAccess();
      callback(false);
      return;
    }

    try {
      const isAdmin = await hasFirebaseAdminAccess(user);

      if (isAdmin) {
        grantAdminAccess();
      } else {
        revokeAdminAccess();
      }

      callback(isAdmin);
    } catch {
      revokeAdminAccess();
      callback(false);
    }
  });
}

export async function loginAdmin(code) {
  const password = code.trim();

  if (!adminEmail) {
    return {
      success: false,
      message:
        'Der Admin-Zugang ist nicht vollständig konfiguriert. Bitte setze VITE_ADMIN_EMAIL in der .env-Datei.',
    };
  }

  if (!password) {
    return {
      success: false,
      message: 'Bitte gib den Admin-Code ein.',
    };
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      adminEmail,
      password,
    );
    const isAdmin = await hasFirebaseAdminAccess(credential.user);

    if (!isAdmin) {
      await signOut(auth);
      revokeAdminAccess();

      return {
        success: false,
        message:
          'Dieser Firebase-Benutzer ist noch nicht als Admin freigeschaltet.',
      };
    }

    grantAdminAccess();

    return {
      success: true,
      message: '',
    };
  } catch {
    revokeAdminAccess();

    return {
      success: false,
      message:
        'Der eingegebene Admin-Code ist nicht korrekt oder der Firebase-Admin-Login ist noch nicht eingerichtet.',
    };
  }
}

export async function ensureAdminSession() {
  const isAdmin = await hasFirebaseAdminAccess();

  if (!isAdmin) {
    throw Object.assign(new Error('Missing Firebase admin access.'), {
      code: 'admin/unauthorized',
    });
  }

  return auth.currentUser;
}
