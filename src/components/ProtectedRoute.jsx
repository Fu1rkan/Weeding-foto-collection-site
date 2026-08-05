import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ensureAnonymousSession } from '../services/firebaseAuthService.js';
import { hasGuestAccess } from '../services/guestAccessService.js';
import { routes } from '../utils/routes.js';

export default function ProtectedRoute() {
  const location = useLocation();
  const guestAccessGranted = hasGuestAccess();
  const [authStatus, setAuthStatus] = useState(
    guestAccessGranted ? 'checking' : 'idle',
  );

  useEffect(() => {
    if (!guestAccessGranted) {
      setAuthStatus('idle');
      return undefined;
    }

    let isActive = true;

    setAuthStatus('checking');

    ensureAnonymousSession()
      .then(() => {
        if (isActive) {
          setAuthStatus('ready');
        }
      })
      .catch(() => {
        if (isActive) {
          setAuthStatus('error');
        }
      });

    return () => {
      isActive = false;
    };
  }, [guestAccessGranted]);

  if (!guestAccessGranted) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname }}
        to={routes.guestAccess}
      />
    );
  }

  if (authStatus === 'checking') {
    return (
      <div className="gallery-loading" aria-live="polite">
        <span />
        <p>Gästezugang wird vorbereitet...</p>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <section className="content-card access-card">
        <p className="eyebrow">Gästezugang</p>
        <h1>Firebase-Anmeldung fehlgeschlagen.</h1>
        <p>
          Bitte prüfe in Firebase, ob die anonyme Anmeldung aktiviert ist, und
          lade die Seite danach neu.
        </p>
      </section>
    );
  }

  return <Outlet />;
}
