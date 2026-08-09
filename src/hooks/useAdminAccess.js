import { useEffect, useState } from 'react';
import {
  hasStoredAdminAccess,
  loginAdmin,
  subscribeToAdminAccess,
} from '../services/adminAccessService.js';

export function useAdminAccess() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredAdminAccess);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAdminAccess((hasAccess) => {
      setIsAuthenticated(hasAccess);
      setIsChecking(false);
    });

    return unsubscribe;
  }, []);

  async function login(code) {
    const result = await loginAdmin(code);

    if (result.success) {
      setIsAuthenticated(true);
    }

    return result;
  }

  return {
    isAuthenticated,
    isChecking,
    login,
  };
}
