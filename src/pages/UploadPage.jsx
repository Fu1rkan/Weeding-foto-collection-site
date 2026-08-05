import { usePageTitle } from '../hooks/usePageTitle.js';

export default function UploadPage() {
  usePageTitle('Upload');

  return (
    <section className="content-card">
      <p className="eyebrow">Upload</p>
      <h1>Fotos und Videos hochladen</h1>
      <p>
        Der Upload-Bereich ist vorbereitet. Im nächsten Schritt kann hier die
        Datei-Auswahl, Validierung und Speicherung angebunden werden.
      </p>
    </section>
  );
}
