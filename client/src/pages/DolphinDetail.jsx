import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';
import PhotoGallery from '../components/PhotoGallery.jsx';

const pad = (n) => String(n).padStart(2, '0');

export default function DolphinDetail() {
  const { slug } = useParams();
  const dolphin = useLoad(() => api.dolphin(slug), [slug]);
  const all = useLoad(api.dolphins, []);

  const list = all.data ?? [];
  const idx = list.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const d = dolphin.data;

  const facts = d && [
    ['Origin', d.bornAtDrc ? 'Born at DRC' : d.placeOfOrigin],
    ['Date of birth', d.dob],
    ['Parents', d.parents],
    ['Offspring', d.offspring],
    ['Rescued', d.rescued],
    ['Defining features', d.definingFeatures],
  ].filter(([, v]) => v);

  return (
    <div className="page">
      <Link to="/" className="back">← All family</Link>
      <Status loading={dolphin.loading} error={dolphin.error}>
        {d && (
          <>
            <div className="detail-head">
              <h1>{d.name}</h1>
              <div className="pager">
                {prev ? <Link to={`/family/${prev.slug}`}>← {prev.name}</Link> : <span />}
                {next ? <Link to={`/family/${next.slug}`}>{next.name} →</Link> : <span />}
              </div>
            </div>
            <div className="detail-layout">
              <section>
                <dl className="facts">
                  {facts.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                <h2 className="section-title">Photos</h2>
                {d.photos.length ? (
                  <PhotoGallery photos={d.photos} name={d.name} />
                ) : (
                  <p className="empty">No photos on the source slide.</p>
                )}
                {d.animalSigns.length > 0 && (
                  <>
                    <h2 className="section-title">Animal sign</h2>
                    <div className="sign"><PhotoGallery photos={d.animalSigns} name={`${d.name}’s animal sign`} whole /></div>
                  </>
                )}
              </section>
              <aside className="source-peek">
                <h2 className="section-title">Original slide</h2>
                <Link to={`/source/${d.page}`} aria-label={`Open original slide for ${d.name}`}>
                  <img src={`/content/pages/page-${pad(d.page)}.jpg`} alt={`Original slide for ${d.name}`} />
                </Link>
                <Link to={`/source/${d.page}`} className="btn secondary">View in source viewer</Link>
              </aside>
            </div>
          </>
        )}
      </Status>
    </div>
  );
}
