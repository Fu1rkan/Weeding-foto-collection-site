import { signInAnonymously } from 'firebase/auth';
import { auth } from './firebase.js';

let anonymousSessionPromise = null;

export async function ensureAnonymousSession() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!anonymousSessionPromise) {
    anonymousSessionPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => {
        anonymousSessionPromise = null;
      });
  }

  return anonymousSessionPromise;
}
