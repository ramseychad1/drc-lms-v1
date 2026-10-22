import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

export default function Library() {
  const { data, error, loading } = useLoad(api.dolphins, []);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((d) =>
      [d.name, d.parents, d.placeOfOrigin, d.definingFeatures, d.offspring]
        .some((v) => v?.toLowerCase().includes(q)));
  }, [data, search]);

  const letters = useMemo(
    () => [...new Set((data ?? []).map((d) => d.name[0].toUpperCase()))], [data]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dolphin Profiles</h1>
        <p className="lede">
          Every dolphin from the ID slideshow, indexed by name. Pick one to see the full profile and all of its photos.
        </p>
      </div>
      <Status loading={loading} error={error}>
        <div className="toolbar">
          <input type="search" placeholder="Search by name, parents, features…" value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label="Search dolphins" />
          <span className="count">{filtered.length} of {data?.length}</span>
        </div>
        {!search && (
          <nav className="az" aria-label="Jump to letter">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`}>{l}</a>
            ))}
          </nav>
        )}
        {filtered.length === 0 ? (
          <p className="empty">No dolphins match “{search}”.</p>
        ) : (
          <ul className="card-grid">
            {filtered.map((d, i) => {
              const first = !search && (i === 0 || filtered[i - 1].name[0].toUpperCase() !== d.name[0].toUpperCase());
              return (
                <li key={d.slug} id={first ? `letter-${d.name[0].toUpperCase()}` : undefined}>
                  <Link to={`/dolphins/${d.slug}`} className="dolphin-card">
                    {d.photos[0] && <img src={d.photos[0].thumb} alt="" loading="lazy" />}
                    <div className="dolphin-card-body">
                      <h2>{d.name}</h2>
                      <p>{d.dob ? `Born ${d.dob}` : 'Birth date unknown'}</p>
                      <span className={`badge ${d.bornAtDrc ? 'drc' : ''}`}>
                        {d.bornAtDrc ? 'Born at DRC' : d.placeOfOrigin ?? 'Origin unknown'}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Status>
    </div>
  );
}
