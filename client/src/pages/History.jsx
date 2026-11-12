import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

const MODE_LABELS = { all: 'All topics', 'animal-sign': 'Animal signs', 'pick-sign': 'Pick the sign' };

const summarize = (quizzes) => ({
  count: quizzes.length,
  avg: quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.percent, 0) / quizzes.length) : 0,
  best: quizzes.length ? Math.max(...quizzes.map((q) => q.percent)) : 0,
});

// One row per player, most quizzes first. Quizzes come newest-first, so the first one seen is the latest.
const byPlayer = (quizzes) => {
  const groups = new Map();
  for (const q of quizzes) {
    if (!q.user) continue;
    const g = groups.get(q.user.id) ?? { user: q.user, quizzes: [] };
    g.quizzes.push(q);
    groups.set(q.user.id, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, ...summarize(g.quizzes), last: g.quizzes[0].completedAt }))
    .sort((a, b) => b.count - a.count || a.user.name.localeCompare(b.user.name));
};

export default function History() {
  const { data, error, loading } = useLoad(api.quizzes, []);
  const [params, setParams] = useSearchParams();
  const userId = Number(params.get('user')) || null;
  const players = data ? byPlayer(data) : [];
  const selected = players.find((p) => p.user.id === userId) ?? null;
  const shown = selected ? selected.quizzes : data ?? [];
  const stats = summarize(shown);
  const pick = (id) => setParams(id ? { user: String(id) } : {}, { replace: true });

  return (
    <div className="page">
      <div className="page-head">
        <h1>Quiz History</h1>
        <p className="lede">Every completed quiz, newest first.</p>
      </div>
      <Status loading={loading} error={error}>
        {data?.length === 0 ? (
          <p className="empty">No quizzes yet. <Link to="/quiz">Take your first quiz →</Link></p>
        ) : (
          <>
            {players.length > 0 && (
              <>
                <h2 className="section-title">Scores by player</h2>
                <div className="table-wrap players-table">
                  <table>
                    <thead>
                      <tr><th>Player</th><th>Quizzes</th><th>Average</th><th>Best</th><th>Last quiz</th></tr>
                    </thead>
                    <tbody>
                      {players.map((p) => (
                        <tr key={p.user.id} className={p.user.id === userId ? 'selected' : ''}>
                          <td>
                            <button className="link" onClick={() => pick(p.user.id === userId ? null : p.user.id)}>
                              {p.user.name}
                            </button>
                          </td>
                          <td>{p.count}</td>
                          <td><b>{p.avg}%</b></td>
                          <td>{p.best}%</td>
                          <td>{formatDate(p.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="history-head">
              <h2 className="section-title">{selected ? `${selected.user.name}’s quizzes` : 'All quizzes'}</h2>
              <div className="presets" role="group" aria-label="Filter by player">
                <button className={`chip ${!selected ? 'on' : ''}`} onClick={() => pick(null)}>Everyone</button>
                {players.map((p) => (
                  <button key={p.user.id} className={`chip ${p.user.id === userId ? 'on' : ''}`}
                    onClick={() => pick(p.user.id)}>
                    {p.user.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="stats">
              <div><b>{stats.count}</b><span>quizzes taken</span></div>
              <div><b>{stats.avg}%</b><span>average score</span></div>
              <div><b>{stats.best}%</b><span>best score</span></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Player</th><th>Type</th><th>Questions</th><th>Right</th><th>Wrong</th>
                    <th>Score</th><th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((q) => (
                    <tr key={q.id}>
                      <td>{formatDate(q.completedAt)}</td>
                      <td>{q.user?.name ?? '—'}</td>
                      <td><span className="mode-tag">{MODE_LABELS[q.mode] ?? 'All topics'}</span></td>
                      <td>{q.total}</td>
                      <td className="right">{q.correct}</td>
                      <td className="wrong">{q.incorrect}</td>
                      <td><b>{q.percent}%</b></td>
                      <td><Link to={`/history/${q.id}`}>Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Status>
    </div>
  );
}
