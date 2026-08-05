import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasGuestAccess } from '../services/guestAccessService.js';
import { routes } from '../utils/routes.js';

export default function ProtectedRoute() {
  const location = useLocation();

  if (!hasGuestAccess()) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname }}
        to={routes.guestAccess}
      />
    );
  }

  return <Outlet />;
}
