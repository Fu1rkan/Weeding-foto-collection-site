import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { routes } from '../utils/routes.js';

const navItems = [
  { label: 'Start', to: routes.home },
  { label: 'Hochladen', to: routes.upload },
  { label: 'Galerie', to: routes.gallery },
  { label: 'Admin', to: routes.admin },
];

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header" ref={headerRef}>
      <button
        aria-controls="main-navigation"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
        className={`nav-toggle${isMenuOpen ? ' is-open' : ''}`}
        onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span aria-hidden="true" className="nav-toggle-lines" />
      </button>

      <nav
        className={`main-nav${isMenuOpen ? ' is-open' : ''}`}
        id="main-navigation"
        aria-label="Hauptnavigation"
      >
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
