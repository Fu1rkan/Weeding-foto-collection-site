import { useState } from 'react';
import {
  grantAdminAccess,
  hasAdminAccess,
  isValidAdminCode,
} from '../services/adminAccessService.js';

export function useAdminAccess() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasAdminAccess);

  function login(code) {
    if (!isValidAdminCode(code)) {
      return {
        success: false,
        message: 'Der eingegebene Admin-Code ist nicht korrekt.',
      };
    }

    grantAdminAccess();
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
