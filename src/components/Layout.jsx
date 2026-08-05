import { Outlet } from 'react-router-dom';
import Navigation from './Navigation.jsx';

export default function Layout() {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
