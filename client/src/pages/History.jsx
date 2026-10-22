import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

export default function History() {
  const { data, error, loading } = useLoad(api.quizzes, []);
  const avg = data?.length ? Math.round(data.reduce((s, q) => s + q.percent, 0) / data.length) : 0;
  const best = data?.length ? Math.max(...data.map((q) => q.percent)) : 0;

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
            <div className="stats">
              <div><b>{data?.length}</b><span>quizzes taken</span></div>
              <div><b>{avg}%</b><span>average score</span></div>
              <div><b>{best}%</b><span>best score</span></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Questions</th><th>Right</th><th>Wrong</th><th>Score</th><th /></tr>
                </thead>
                <tbody>
                  {data?.map((q) => (
                    <tr key={q.id}>
                      <td>{formatDate(q.completedAt)}</td>
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
