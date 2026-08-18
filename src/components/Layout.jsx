import { Outlet } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop.js';
import Navigation from './Navigation.jsx';

export default function Layout() {
  useScrollToTop();

  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
