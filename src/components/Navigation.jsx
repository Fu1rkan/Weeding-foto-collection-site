import { NavLink } from 'react-router-dom';
import { routes } from '../utils/routes.js';

export default function Navigation() {
  return (
    <header className="site-header">
      <NavLink className="brand" to={routes.home}>
        M & S
      </NavLink>

      <nav className="main-nav" aria-label="Hauptnavigation">
        <NavLink to={routes.home}>Start</NavLink>
        <NavLink to={routes.upload}>Hochladen</NavLink>
        <NavLink to={routes.gallery}>Galerie</NavLink>
      </nav>
    </header>
  );
}
