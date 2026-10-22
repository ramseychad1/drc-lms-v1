import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

const NONE = /^(none|unknown|born\b.*)$/i;

// "Merina/Noel (Miami Seaquarium)", "Delta & Diva", "Santini, Brisby (Six Flags, CA)" -> name tokens.
// A token carrying a location in parentheses is not linked: it may be a different animal with the same name.
function tokens(text) {
  if (!text || NONE.test(text.trim())) return [];
  const masked = text.replace(/\([^)]*\)/g, (m) => m.replace(/,/g, ';'));
  return masked.split(/\s*(?:\/|&|,)\s*/).map((t) => t.replace(/;/g, ',').trim()).filter((t) => t && !NONE.test(t));
}

function buildTree(dolphins) {
  const byName = new Map(dolphins.map((d) => [d.name.toLowerCase(), d]));
  const resolve = (text) => tokens(text).map((t) => byName.get(t.toLowerCase()) ?? { name: t, external: true });
  const parents = new Map(dolphins.map((d) => [d.slug, resolve(d.parents)]));
  const children = new Map(dolphins.map((d) => [d.slug, new Map()]));
  // Offspring is recorded from both directions: a parent's "Offspring" line and a child's "Parents" line.
  for (const d of dolphins) {
    for (const c of resolve(d.offspring)) if (!c.external) children.get(d.slug).set(c.slug, c);
    for (const p of parents.get(d.slug)) if (!p.external) children.get(p.slug).set(d.slug, d);
  }
  return {
    parentsOf: (slug) => parents.get(slug) ?? [],
    childrenOf: (slug) => [...(children.get(slug)?.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Everyone: roots are animals with no parent in the family; each branch lists descendants.
// An animal with two in-family parents appears under both.
function Branch({ d, tree, path, onFocus }) {
  const kids = path.includes(d.slug) ? [] : tree.childrenOf(d.slug);
  return (
    <li>
      <Node d={d} compact onFocus={onFocus} />
      {kids.length > 0 && (
        <ul>{kids.map((c) => <Branch key={c.slug} d={c} tree={tree} path={[...path, d.slug]} onFocus={onFocus} />)}</ul>
      )}
    </li>
  );
}

function Everyone({ data, tree, onFocus }) {
  const hasParent = (d) => tree.parentsOf(d.slug).some((p) => !p.external);
  const roots = data.filter((d) => !hasParent(d) && tree.childrenOf(d.slug).length > 0);
  const loners = data.filter((d) => !hasParent(d) && tree.childrenOf(d.slug).length === 0);
  return (
    <>
      <div className="org-scroll">
        <ul className="org">
          {roots.map((d) => <Branch key={d.slug} d={d} tree={tree} path={[]} onFocus={onFocus} />)}
        </ul>
      </div>
      <section className="tree-tier loners" aria-label="No relatives on record">
        <h2>No relatives on record</h2>
        <div className="tree-row">{loners.map((d) => <Node key={d.slug} d={d} compact onFocus={onFocus} />)}</div>
      </section>
    </>
  );
}

function Node({ d, focus, compact, onFocus }) {
  if (d.external) {
    return (
      <div className="tree-node external" title="Not in the DRC family slideshow">
        <div className="tree-thumb placeholder" aria-hidden="true">🐬</div>
        <span className="tree-name">{d.name}</span>
      </div>
    );
  }
  return (
    <div className={`tree-node ${focus ? 'focus' : ''} ${compact ? 'compact' : ''}`}>
      <Link to={`/family/${d.slug}`} className="tree-link">
        {d.photos[0]
          ? <img className="tree-thumb" src={d.photos[0].thumb} alt="" loading="lazy" />
          : <div className="tree-thumb placeholder" aria-hidden="true">🐬</div>}
        <span className="tree-name">{d.name}</span>
      </Link>
      {!focus && !compact && <button type="button" className="tree-recenter" onClick={() => onFocus(d.slug)}>View tree</button>}
    </div>
  );
}

function Tier({ label, items, onFocus, empty }) {
  return (
    <section className="tree-tier" aria-label={label}>
      <h2>{label}</h2>
      {items.length === 0
        ? <p className="tree-empty">{empty}</p>
        : <div className="tree-row">{items.map((d) => <Node key={d.slug ?? d.name} d={d} onFocus={onFocus} />)}</div>}
    </section>
  );
}

export default function FamilyTree() {
  const { data, error, loading } = useLoad(api.dolphins, []);
  const [params, setParams] = useSearchParams();
  const tree = useMemo(() => (data ? buildTree(data) : null), [data]);
  const current = data?.find((d) => d.slug === params.get('animal'));
  const focus = (slug) => setParams(slug ? { animal: slug } : {});

  return (
    <div className="page">
      <div className="page-head">
        <h1>Family Tree</h1>
        <p className="lede">
          Everyone is shown by default, with offspring branching below their parents. Select any name to open the full
          profile, or choose one animal from the list to see only its parents and offspring.
        </p>
      </div>
      <Status loading={loading} error={error}>
        {data && tree && (
          <>
            <div className="toolbar">
              <label htmlFor="tree-select">Animal</label>
              <select id="tree-select" value={current?.slug ?? ''} onChange={(e) => focus(e.target.value)}>
                <option value="">All</option>
                {data.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
            </div>
            {!current ? <Everyone data={data} tree={tree} onFocus={focus} /> : (<>
            <div className="family-tree">
              <Tier label="Parents" items={tree.parentsOf(current.slug)} onFocus={focus}
                empty={current.parents ? `No parents on record (${current.parents}).` : 'No parents on record.'} />
              <div className="tree-connector" aria-hidden="true" />
              <section className="tree-tier" aria-label="Selected animal">
                <div className="tree-row"><Node d={current} focus onFocus={focus} /></div>
              </section>
              <div className="tree-connector" aria-hidden="true" />
              <Tier label="Offspring" items={tree.childrenOf(current.slug)} onFocus={focus}
                empty="No offspring on record." />
            </div>
            <p className="tree-note">Dashed cards with a dolphin icon are parents who aren’t part of the slideshow family.</p>
            </>)}
          </>
        )}
      </Status>
    </div>
  );
}
