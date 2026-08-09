const DEFAULT_VIDEO_PREVIEW_TIME = 0.1;

export function getVideoPreviewSource(source, time = DEFAULT_VIDEO_PREVIEW_TIME) {
  if (!source) {
    return '';
  }

  const cleanSource = source.split('#')[0];

  return `${cleanSource}#t=${time}`;
}
