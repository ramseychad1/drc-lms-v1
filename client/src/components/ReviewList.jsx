import { Link } from 'react-router-dom';
import PhotoGallery from './PhotoGallery.jsx';

export default function ReviewList({ questions }) {
  return (
    <ol className="review">
      {questions.map((q) => (
        <li key={q.position} className={q.isCorrect ? 'right' : 'wrong'}>
          <div className="review-head">
            <span className="mark" aria-label={q.isCorrect ? 'Correct' : 'Incorrect'}>{q.isCorrect ? '✓' : '✗'}</span>
            <strong>{q.prompt}</strong>
          </div>
          {q.photos && <PhotoGallery photos={q.photos} name={q.dolphin.name} />}
          <p>Your answer: <span>{q.selectedAnswer}</span></p>
          {!q.isCorrect && <p>Correct answer: <b>{q.correctAnswer}</b></p>}
          <p className="review-links">
            <Link to={`/dolphins/${q.dolphin.slug}`}>{q.dolphin.name}’s profile</Link>
            {' · '}
            <Link to={`/source/${q.dolphin.page}`}>Source slide</Link>
          </p>
        </li>
      ))}
    </ol>
  );
}
