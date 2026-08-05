import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import HomePage from './pages/HomePage.jsx';
import UploadPage from './pages/UploadPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="galerie" element={<GalleryPage />} />
      </Route>
    </Routes>
  );
}
