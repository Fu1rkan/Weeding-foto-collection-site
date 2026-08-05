import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'));
const GuestAccessPage = lazy(() => import('./pages/GuestAccessPage.jsx'));
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const UploadPage = lazy(() => import('./pages/UploadPage.jsx'));

function PageLoader() {
  return (
    <div className="gallery-loading" aria-live="polite">
      <span />
      <p>Seite wird geladen...</p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="zugang" element={<GuestAccessPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="upload" element={<UploadPage />} />
            <Route path="galerie" element={<GalleryPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
