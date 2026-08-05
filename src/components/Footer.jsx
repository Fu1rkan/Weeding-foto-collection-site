import { weddingDetails } from '../utils/weddingDetails.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-logo">{weddingDetails.coupleNames}</p>
        <p>Danke, dass ihr diesen Tag mit uns feiert.</p>
      </div>
      <p>{weddingDetails.displayDate}</p>
    </footer>
  );
}
