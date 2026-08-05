import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { routes } from '../utils/routes.js';
import {
  faqItems,
  galleryItems,
  timelineItems,
  weddingDetails,
} from '../utils/weddingDetails.js';

export default function HomePage() {
  usePageTitle('Start');

  const countdown = useCountdown(weddingDetails.weddingDate);
  const countdownItems = [
    { label: 'Tage', value: countdown.days },
    { label: 'Stunden', value: countdown.hours },
    { label: 'Minuten', value: countdown.minutes },
    { label: 'Sekunden', value: countdown.seconds },
  ];

  return (
    <div className="landing-page">
      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">Wir feiern Liebe</p>
          <h1>{weddingDetails.coupleNames}</h1>
          <p className="wedding-date">{weddingDetails.displayDate}</p>
          <p className="hero-text">
            Teilt eure schönsten Fotos und Videos mit dem Brautpaar und sammelt
            die Erinnerungen an diesen besonderen Tag an einem Ort.
          </p>
          <div className="hero-actions">
            <Link className="button-link" to={routes.upload}>
              Fotos & Videos hochladen
            </Link>
            <a className="text-link" href="#zeitplan">
              Zeitplan ansehen
            </a>
          </div>
        </div>
      </section>

      <section className="section-card countdown-section" aria-labelledby="countdown-title">
        <div>
          <p className="eyebrow">Countdown</p>
          <h2 id="countdown-title">Bis zur Hochzeit</h2>
        </div>
        <div className="countdown-grid">
          {countdownItems.map((item) => (
            <div className="countdown-item" key={item.label}>
              <span>{String(item.value).padStart(2, '0')}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-grid" id="zeitplan">
        <div className="section-intro">
          <p className="eyebrow">Ablauf</p>
          <h2>Zeitplan</h2>
          <p>Ein erster Überblick über die wichtigsten Momente des Tages.</p>
        </div>
        <div className="timeline">
          {timelineItems.map((item) => (
            <article className="timeline-item" key={item.time}>
              <time>{item.time}</time>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid location-section">
        <div className="section-intro">
          <p className="eyebrow">Location</p>
          <h2>{weddingDetails.venueName}</h2>
          <p>{weddingDetails.venueAddress}</p>
        </div>
        <div className="map-card" aria-label="Platzhalter für die Location-Karte">
          <span>♡</span>
          <p>Hier entsteht später die Kartenansicht zur Location.</p>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <p className="eyebrow">Galerie</p>
          <h2>Bildergalerie</h2>
          <p>Dummy-Vorschau für die späteren Erinnerungen der Gäste.</p>
        </div>
        <div className="gallery-grid">
          {galleryItems.map((item, index) => (
            <article className="gallery-tile" key={item}>
              <span>0{index + 1}</span>
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid faq-section">
        <div className="section-intro">
          <p className="eyebrow">FAQ</p>
          <h2>Fragen & Antworten</h2>
        </div>
        <div className="faq-list">
          {faqItems.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
