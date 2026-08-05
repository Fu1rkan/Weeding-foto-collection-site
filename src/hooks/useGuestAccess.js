import { useState } from 'react';
import {
  grantGuestAccess,
  hasGuestAccess,
  isValidGuestCode,
} from '../services/guestAccessService.js';
import { ensureAnonymousSession } from '../services/firebaseAuthService.js';

export function useGuestAccess() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasGuestAccess);

  async function login(code) {
    if (!isValidGuestCode(code)) {
      return {
        success: false,
        message: 'Der eingegebene Zugangscode ist nicht korrekt.',
      };
    }

    try {
      await ensureAnonymousSession();
      grantGuestAccess();
      setIsAuthenticated(true);
    } catch {
      return {
        success: false,
        message:
          'Firebase konnte den Gästezugang nicht starten. Bitte prüfe, ob anonyme Anmeldung aktiviert ist.',
      };
    }

    return {
      success: true,
      message: '',
    };
  }

  return {
    isAuthenticated,
    login,
  };
}
