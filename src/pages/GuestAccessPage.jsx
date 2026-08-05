import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuestAccess } from '../hooks/useGuestAccess.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { routes } from '../utils/routes.js';

export default function GuestAccessPage() {
  usePageTitle('Gästezugang');

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, login } = useGuestAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const targetPath = location.state?.from ?? routes.upload;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, targetPath]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = await login(code);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    navigate(targetPath, { replace: true });
  }

  return (
    <section className="content-card access-card">
      <p className="eyebrow">Gästezugang</p>
      <h1>Willkommen, ihr Lieben.</h1>
      <p>
        Bitte gebt den gemeinsamen Hochzeitscode ein, um Fotos und Videos
        hochladen oder ansehen zu können.
      </p>

      <form className="access-form" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor="guest-code">
          Zugangscode
          <input
            autoComplete="one-time-code"
            id="guest-code"
            disabled={isSubmitting}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
            placeholder="Code eingeben"
            type="password"
            value={code}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="button-link" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Einloggen...' : 'Einloggen'}
        </button>
      </form>
    </section>
  );
}
