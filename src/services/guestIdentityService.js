const GUEST_ID_STORAGE_KEY = 'weddingGuestId';

export function getGuestId() {
  const existingGuestId = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);

  if (existingGuestId) {
    return existingGuestId;
  }

  const guestId =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);

  return guestId;
}
