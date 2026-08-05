import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { routes } from '../utils/routes.js';

export default function HomePage() {
  usePageTitle('Start');

  return (
    <section className="hero-section">
      <p className="eyebrow">Hochzeitsmomente sammeln</p>
      <h1>Teilt eure schönsten Fotos und Videos mit dem Brautpaar.</h1>
      <p className="hero-text">
        Diese Seite wird der zentrale Ort, an dem Gäste Erinnerungen vom großen
        Tag hochladen und später gemeinsam ansehen können.
      </p>
      <Link className="button-link" to={routes.upload}>
        Fotos & Videos hochladen
      </Link>
    </section>
  );
}
