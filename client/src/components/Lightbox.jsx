import { useEffect } from 'react';

// Full-screen image viewer. `images` is [{ url, alt }]; arrows/Esc work from the keyboard.
export default function Lightbox({ images, index, onClose, onIndex }) {
  const many = images.length > 1;
  const go = (delta) => onIndex((index + delta + images.length) % images.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowRight') go(1);
      else if (many && e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const img = images[index];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={img.alt} onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">×</button>
      {many && (
        <button className="lightbox-nav prev" aria-label="Previous"
          onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
      )}
      <img src={img.url} alt={img.alt} onClick={(e) => e.stopPropagation()} />
      {many && (
        <button className="lightbox-nav next" aria-label="Next"
          onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
      )}
      <div className="lightbox-caption">
        {img.alt}{many && ` · ${index + 1} / ${images.length}`}
      </div>
    </div>
  );
}
