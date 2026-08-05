const ACCESS_STORAGE_KEY = 'weddingGuestAccessGranted';
const guestAccessCode = import.meta.env.VITE_GUEST_ACCESS_CODE;

export function hasGuestAccess() {
  return window.localStorage.getItem(ACCESS_STORAGE_KEY) === 'true';
}

export function grantGuestAccess() {
  window.localStorage.setItem(ACCESS_STORAGE_KEY, 'true');
}

export function isValidGuestCode(code) {
  return code.trim() === guestAccessCode;
}
