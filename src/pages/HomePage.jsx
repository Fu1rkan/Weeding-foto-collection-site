import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import coupleSignature from '../assets/marcel-sophia-signature.png';
import { useCountdown } from '../hooks/useCountdown.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { routes } from '../utils/routes.js';
import {
  contactInfo,
  dressCodeItems,
  faqItems,
  galleryItems,
  locationItems,
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
          <img
            className="hero-signature"
            src={coupleSignature}
            alt={weddingDetails.coupleNames}
          />
          <p className="wedding-date">{weddingDetails.displayDate}</p>
          <p className="hero-text">
            Teilt eure schönsten Fotos und Videos mit dem Brautpaar und sammelt
            die Erinnerungen an diesen besonderen Tag an einem Ort.
          </p>
          <div className="hero-actions">
            <Link className="button-link" to={routes.upload}>
              Fotos & Videos hochladen
            </Link>
            <a className="text-link" href="#ablauf">
              Ablauf ansehen
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

      <section className="section-grid" id="ablauf">
        <div className="section-intro">
          <p className="eyebrow">Ablauf</p>
          <h2>Ablauf des Tages</h2>
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

      <section className="section-card location-section">
        <div className="section-heading">
          <p className="eyebrow">Location</p>
          <h2>{weddingDetails.venueName}</h2>
          <p>{weddingDetails.venueAddress}</p>
        </div>
        <div className="location-list" aria-label="Standorte der Hochzeit">
          {locationItems.map((location) => {
            const mapQuery = encodeURIComponent(location.mapQuery);

            return (
              <article className="location-card" key={location.name}>
                <div className="location-info">
                  <p className="location-time">{location.time}</p>
                  <h3>{location.name}</h3>
                </div>

                <div className="location-map-panel">
                  <iframe
                    allowFullScreen
                    className="location-map"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                    title={`Karte: ${location.name}`}
                  />
                  <a
                    className="location-map-link"
                    href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    In Maps öffnen
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <p className="eyebrow">Dresscode</p>
          <h2>Was ziehe ich an?</h2>
          <p>Ein paar grobe Leitplanken, damit sich der Tag stimmig anfühlt.</p>
        </div>
        <div className="dresscode-grid">
          {dressCodeItems.map((item) => (
            <article className="dresscode-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
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

      <section className="section-grid contact-section">
        <div className="section-intro">
          <p className="eyebrow">Kontakt</p>
          <h2>Habt ihr Fragen?</h2>
          <p>{contactInfo.note}</p>
        </div>
        <div className="contact-card">
          <h3>{contactInfo.name}</h3>
          <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
          <a href={`tel:${contactInfo.phone.replaceAll(' ', '')}`}>{contactInfo.phone}</a>
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
