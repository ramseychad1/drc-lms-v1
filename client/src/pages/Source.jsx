import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

// Browse the original slides as images, one per page, indexed by name.
export default function Source() {
  const { page } = useParams();
  const navigate = useNavigate();
  const { data: pages, error, loading } = useLoad(api.sourcePages, []);
  const [zoomed, setZoomed] = useState(false);
  const activeRef = useRef(null);

  const current = Number(page) || 1;
  const idx = pages ? Math.max(0, pages.findIndex((p) => p.page === current)) : 0;
  const slide = pages?.[idx];
  const go = (delta) => {
    const n = pages?.[idx + delta];
    if (n) navigate(`/source/${n.page}`);
  };

  useEffect(() => { setZoomed(false); }, [current]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [current, pages]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Source Slides</h1>
        <p className="lede">The original slideshow, page by page. Use ← → to flip through, or pick a name.</p>
      </div>
      <Status loading={loading} error={error}>
        {slide && (
          <div className="source-layout">
            <ol className="filmstrip" aria-label="Slides">
              {pages.map((p) => (
                <li key={p.page}>
                  <Link to={`/source/${p.page}`} ref={p.page === slide.page ? activeRef : null}
                    className={p.page === slide.page ? 'active' : ''}
                    aria-current={p.page === slide.page ? 'page' : undefined}>
                    <img src={p.image} alt="" loading="lazy" />
                    <span><b>{p.page}</b> {p.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <section className="viewer">
              <div className="viewer-bar">
                <button className="btn secondary" onClick={() => go(-1)} disabled={idx === 0}>← Prev</button>
                <div className="viewer-title">
                  <strong>{slide.title}</strong>
                  <span>Slide {slide.page} of {pages.length}</span>
                </div>
                <button className="btn secondary" onClick={() => go(1)} disabled={idx === pages.length - 1}>Next →</button>
              </div>
              <div className={`viewer-stage ${zoomed ? 'zoomed' : ''}`}>
                <img src={slide.image} alt={`Original slide: ${slide.title}`}
                  onClick={() => setZoomed((z) => !z)}
                  title={zoomed ? 'Click to fit' : 'Click to zoom'} />
              </div>
              <div className="viewer-actions">
                <button className="btn secondary" onClick={() => setZoomed((z) => !z)}>
                  {zoomed ? 'Fit to screen' : 'Zoom'}
                </button>
                {slide.slug && <Link className="btn" to={`/family/${slide.slug}`}>Open {slide.title}’s profile</Link>}
              </div>
            </section>
          </div>
        )}
      </Status>
    </div>
  );
}
