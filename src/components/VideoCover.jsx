import { getVideoPreviewSource } from '../utils/videoPreviewUtils.js';

export function VideoCover({
  downloadUrl,
  fileName,
  isLightbox = false,
  thumbnailUrl,
}) {
  if (isLightbox) {
    return (
      <video
        controls
        playsInline
        poster={thumbnailUrl || undefined}
        preload="metadata"
        src={downloadUrl}
      />
    );
  }

  if (thumbnailUrl) {
    return (
      <img
        alt={`${fileName} Video-Cover`}
        decoding="async"
        loading="lazy"
        src={thumbnailUrl}
      />
    );
  }

  return (
    <video
      aria-label={`${fileName} Video-Vorschau`}
      muted
      playsInline
      preload="metadata"
      src={getVideoPreviewSource(downloadUrl)}
    />
  );
}
