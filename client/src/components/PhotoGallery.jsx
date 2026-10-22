import { useState } from 'react';
import Lightbox from './Lightbox.jsx';

// Every photo for one dolphin, shown together; click any to enlarge.
// `whole` shows each image uncropped (animal signs are often tall or wide objects).
export default function PhotoGallery({ photos, name, clickable = true, whole = false }) {
  const [open, setOpen] = useState(null);
  const images = photos.map((p, i) => ({ url: p.url, alt: `${name}, photo ${i + 1}` }));
  return (
    <>
      <div className={`gallery n${Math.min(photos.length, 4)}${whole ? ' whole' : ''}`}>
        {photos.map((p, i) => (
          clickable ? (
            <button key={p.url} className="gallery-item" onClick={() => setOpen(i)}
              aria-label={`Enlarge photo ${i + 1}`}>
              <img src={p.thumb} alt={images[i].alt} loading="lazy" />
            </button>
          ) : (
            <div key={p.url} className="gallery-item"><img src={p.thumb} alt="" /></div>
          )
        ))}
      </div>
      {open !== null && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
