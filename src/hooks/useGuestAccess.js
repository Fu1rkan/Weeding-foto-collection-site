import { useState } from 'react';
import {
  grantGuestAccess,
  hasGuestAccess,
  isValidGuestCode,
} from '../services/guestAccessService.js';

export function useGuestAccess() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasGuestAccess);

  function login(code) {
    if (!isValidGuestCode(code)) {
      return {
        success: false,
        message: 'Der eingegebene Zugangscode ist nicht korrekt.',
      };
    }

    grantGuestAccess();
    setIsAuthenticated(true);

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
