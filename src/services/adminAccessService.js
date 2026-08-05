const ADMIN_ACCESS_STORAGE_KEY = 'weddingAdminAccessGranted';
const adminAccessCode = import.meta.env.VITE_ADMIN_ACCESS_CODE;

export function hasAdminAccess() {
  return window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === 'true';
}

export function grantAdminAccess() {
  window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, 'true');
}

export function isValidAdminCode(code) {
  return code.trim() === adminAccessCode;
}
