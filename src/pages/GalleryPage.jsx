import { usePageTitle } from '../hooks/usePageTitle.js';

export default function GalleryPage() {
  usePageTitle('Galerie');

  return (
    <section className="content-card">
      <p className="eyebrow">Galerie</p>
      <h1>Geteilte Erinnerungen</h1>
      <p>
        Die Galerie-Seite ist als Platzhalter angelegt und kann später die
        hochgeladenen Fotos und Videos anzeigen.
      </p>
    </section>
  );
}
