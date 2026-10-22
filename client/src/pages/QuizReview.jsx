import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';
import ReviewList from '../components/ReviewList.jsx';

export default function QuizReview() {
  const { id } = useParams();
  const { data: q, error, loading } = useLoad(() => api.quiz(id), [id]);
  return (
    <div className="page">
      <Link to="/history" className="back">← History</Link>
      <Status loading={loading} error={error}>
        {q && (
          <>
            <div className="page-head">
              <h1>{q.percent}% — {q.correct} of {q.total} correct</h1>
              <p className="lede">{formatDate(q.completedAt)}</p>
            </div>
            <ReviewList questions={q.questions} />
          </>
        )}
      </Status>
    </div>
  );
}
