import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import GuestAccessPage from './pages/GuestAccessPage.jsx';
import HomePage from './pages/HomePage.jsx';
import UploadPage from './pages/UploadPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="zugang" element={<GuestAccessPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="upload" element={<UploadPage />} />
          <Route path="galerie" element={<GalleryPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
