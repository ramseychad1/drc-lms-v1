import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import PhotoGallery from '../components/PhotoGallery.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ReviewList from '../components/ReviewList.jsx';

const pad = (n) => String(n).padStart(2, '0');

const verdict = (pct) =>
  pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Nice work!' : pct >= 50 ? 'Getting there.' : 'Keep practicing — you’ll get them.';

export default function Quiz() {
  const dolphins = useLoad(api.dolphins, []);
  const [mode, setMode] = useState('all');
  const signCount = dolphins.data?.filter((d) => d.animalSigns.length > 0).length ?? 25;
  const max = mode === 'animal-sign' ? signCount : dolphins.data?.length ?? 36;

  const [count, setCount] = useState(10);
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState(null); // answer result for the current question
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tally, setTally] = useState({ correct: 0, answered: 0 });
  const [finished, setFinished] = useState(null); // full quiz record with review
  const [slideOpen, setSlideOpen] = useState(false);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const q = await api.startQuiz(Math.min(count, max), mode);
      setQuiz(q); setIndex(0); setFeedback(null); setPicked(null);
      setTally({ correct: 0, answered: 0 }); setFinished(null);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const question = quiz?.questions[index];

  const choose = async (option) => {
    if (feedback || busy) return;
    setBusy(true); setPicked(option); setError(null);
    try {
      const res = await api.answer(quiz.id, question.id, option);
      setFeedback(res);
      setTally((t) => ({ correct: t.correct + (res.correct ? 1 : 0), answered: t.answered + 1 }));
    } catch (e) { setError(e); setPicked(null); } finally { setBusy(false); }
  };

  const next = async () => {
    if (index + 1 < quiz.total) {
      setIndex(index + 1); setFeedback(null); setPicked(null);
      return;
    }
    setBusy(true);
    try { setFinished(await api.quiz(quiz.id)); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!question) return;
    const onKey = (e) => {
      if (slideOpen) return;
      const n = Number(e.key);
      if (!feedback && n >= 1 && n <= question.options.length) choose(question.options[n - 1]);
      else if (feedback && (e.key === 'Enter' || e.key === 'ArrowRight')) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Results ----
  if (finished) {
    return (
      <div className="page">
        <div className="score-card">
          <p className="score-verdict">{verdict(finished.percent)}</p>
          <p className="score-pct">{finished.percent}%</p>
          <div className="score-split">
            <div className="right"><b>{finished.correct}</b> correct</div>
            <div className="wrong"><b>{finished.incorrect}</b> incorrect</div>
            <div><b>{finished.total}</b> questions</div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => { setQuiz(null); setFinished(null); }}>Take another quiz</button>
            <Link className="btn secondary" to="/history">View history</Link>
          </div>
        </div>
        <h2 className="section-title">Review</h2>
        <ReviewList questions={finished.questions} />
      </div>
    );
  }

  // ---- Running ----
  if (quiz && question) {
    return (
      <div className="page quiz">
        <div className="progress-row">
          <span>Question {index + 1} of {quiz.total}</span>
          <span>{tally.correct} correct so far</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={quiz.total}
          aria-valuenow={tally.answered}>
          <div style={{ width: `${(tally.answered / quiz.total) * 100}%` }} />
        </div>

        <section className="q-card">
          <h1 className="q-prompt">{question.prompt}</h1>
          {question.photos && <PhotoGallery photos={question.photos} name="Mystery animal" whole={question.field === 'animal-sign'} />}
          <div className="options" role="group" aria-label="Answer choices">
            {question.options.map((opt, i) => {
              let cls = 'option';
              if (feedback) {
                if (opt === feedback.correctAnswer) cls += ' correct';
                else if (opt === picked) cls += ' incorrect';
                else cls += ' dim';
              }
              return (
                <button key={opt} className={cls} disabled={!!feedback || busy} onClick={() => choose(opt)}>
                  <kbd>{i + 1}</kbd><span>{opt}</span>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`feedback ${feedback.correct ? 'right' : 'wrong'}`} role="status">
              <strong>{feedback.correct ? '✓ Correct!' : '✗ Not quite.'}</strong>
              {!feedback.correct && <span> The answer is <b>{feedback.correctAnswer}</b>.</span>}
              <button className="link" onClick={() => setSlideOpen(true)}>View source slide</button>
            </div>
          )}
          {error && <p className="error" role="alert">{error.message}</p>}
          {feedback && (
            <button className="btn next" onClick={next} disabled={busy} autoFocus>
              {index + 1 < quiz.total ? 'Next question →' : 'See results'}
            </button>
          )}
        </section>
        {slideOpen && feedback && (
          <Lightbox images={[{ url: `/content/pages/page-${pad(feedback.dolphin.page)}.jpg`, alt: 'Original source slide' }]}
            index={0} onIndex={() => {}} onClose={() => setSlideOpen(false)} />
        )}
      </div>
    );
  }

  // ---- Setup ----
  const presets = [5, 10, 20].filter((n) => n < max).concat(max);
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Family Quiz</h1>
        <p className="lede">
          Each question picks one fact — birth date, parents, origin, offspring, defining features, or a
          set of photos — from a different family member. Or practice just the animal signs.
        </p>
      </div>
      <div className="setup-card">
        <div className="mode-switch" role="group" aria-label="Quiz type">
          <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
            <b>All topics</b><small>Facts and photos, one per animal</small>
          </button>
          <button className={mode === 'animal-sign' ? 'on' : ''} aria-pressed={mode === 'animal-sign'}
            onClick={() => setMode('animal-sign')}>
            <b>Animal signs only</b><small>Which animal does each sign belong to?</small>
          </button>
        </div>
        <label htmlFor="count">Number of questions: <b>{Math.min(count, max)}</b></label>
        <input id="count" type="range" min="1" max={max} value={Math.min(count, max)}
          onChange={(e) => setCount(Number(e.target.value))} />
        <div className="presets">
          {presets.map((n) => (
            <button key={n} className={`chip ${Math.min(count, max) === n ? 'on' : ''}`} onClick={() => setCount(n)}>
              {n === max ? `All (${n})` : n}
            </button>
          ))}
        </div>
        {error && <p className="error" role="alert">{error.message}</p>}
        <button className="btn big" onClick={start} disabled={busy || dolphins.loading}>
          {busy ? 'Starting…' : 'Start quiz'}
        </button>
      </div>
    </div>
  );
}
