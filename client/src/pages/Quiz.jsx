import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import PhotoGallery from '../components/PhotoGallery.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ReviewList from '../components/ReviewList.jsx';

const pad = (n) => String(n).padStart(2, '0');

// Recent players shown as one-tap buttons (two rows of three on a phone); the rest sit in an accordion.
const QUICK_PICKS = 6;
const NAME_KEY = 'drc-quiz-name';
const loadName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* storage unavailable */ } };
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const verdict = (pct) =>
  pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Nice work!' : pct >= 50 ? 'Getting there.' : 'Keep practicing — you’ll get them.';

export default function Quiz() {
  const dolphins = useLoad(api.dolphins, []);
  const users = useLoad(api.users, []);
  // A tapped player button and the free-text box are separate, so the box only ever holds what was typed.
  const [player, setPlayer] = useState(loadName);
  const [typed, setTyped] = useState('');
  const name = typed.trim() || player;
  const [mode, setMode] = useState('all');
  const signCount = dolphins.data?.filter((d) => d.animalSigns.length > 0).length ?? 25;
  const max = mode === 'animal-sign' || mode === 'pick-sign' ? signCount : dolphins.data?.length ?? 36;

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
      const q = await api.startQuiz(Math.min(count, max), mode, name.trim());
      saveName(q.user.name); setPlayer(q.user.name); setTyped('');
      setQuiz(q); setIndex(0); setFeedback(null); setPicked(null);
      setTally({ correct: 0, answered: 0 }); setFinished(null);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const question = quiz?.questions[index];
  const imageOptions = question?.optionImages; // set when each option is a picture (pick-sign)

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
          <p className="score-verdict">{verdict(finished.percent)}{finished.user && `, ${finished.user.name}`}</p>
          <p className="score-pct">{finished.percent}%</p>
          <div className="score-split">
            <div className="right"><b>{finished.correct}</b> correct</div>
            <div className="wrong"><b>{finished.incorrect}</b> incorrect</div>
            <div><b>{finished.total}</b> questions</div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => { setQuiz(null); setFinished(null); users.reload(); }}>
              Take another quiz
            </button>
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
          <span>{quiz.user.name} · Question {index + 1} of {quiz.total}</span>
          <span>{tally.correct} correct so far</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={quiz.total}
          aria-valuenow={tally.answered}>
          <div style={{ width: `${(tally.answered / quiz.total) * 100}%` }} />
        </div>

        <section className="q-card">
          <h1 className="q-prompt">{question.prompt}</h1>
          {question.photos && <PhotoGallery photos={question.photos} name="Mystery animal" whole={question.field === 'animal-sign'} />}
          <div className={`options${imageOptions ? ' image-options' : ''}`} role="group" aria-label="Answer choices">
            {question.options.map((opt, i) => {
              let cls = 'option';
              if (feedback) {
                if (opt === feedback.correctAnswer) cls += ' correct';
                else if (opt === picked) cls += ' incorrect';
                else cls += ' dim';
              }
              return (
                <button key={opt} className={cls} disabled={!!feedback || busy} onClick={() => choose(opt)}
                  aria-label={imageOptions ? `Sign option ${i + 1}` : undefined}>
                  <kbd>{i + 1}</kbd>
                  {imageOptions ? <img src={imageOptions[opt].thumb} alt="" /> : <span>{opt}</span>}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`feedback ${feedback.correct ? 'right' : 'wrong'}`} role="status">
              <strong>{feedback.correct ? '✓ Correct!' : '✗ Not quite.'}</strong>
              {!feedback.correct && (imageOptions
                ? <span> The correct sign is highlighted in green.</span>
                : <span> The answer is <b>{feedback.correctAnswer}</b>.</span>)}
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
  const allUsers = users.data ?? [];
  const quick = allUsers.slice(0, QUICK_PICKS);
  const more = allUsers.slice(QUICK_PICKS);
  const moreHasSelection = more.some((u) => sameName(u.name, name));
  const isNew = name.trim() && !allUsers.some((u) => sameName(u.name, name));
  const userButton = (u) => (
    <button key={u.id} type="button" className={`chip${sameName(u.name, name) ? ' on' : ''}`}
      aria-pressed={sameName(u.name, name)} onClick={() => { setPlayer(u.name); setTyped(''); }}>
      {u.name}
    </button>
  );
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Family Quiz</h1>
        <p className="lede">
          Each question picks one fact — birth date, parents, origin, offspring, defining features, or a
          set of photos — from a different family member. Or practice just the animal signs, either way round.
        </p>
      </div>
      <div className="setup-card">
        <fieldset className="who">
          <legend>Who’s taking the quiz?</legend>
          {quick.length > 0 && <div className="user-picks">{quick.map(userButton)}</div>}
          {more.length > 0 && (
            <details className="more-users" open={moreHasSelection || undefined}>
              <summary>More players ({more.length})</summary>
              <div className="user-picks">{more.map(userButton)}</div>
            </details>
          )}
          <input className="name-input" type="text" value={typed} maxLength={40} autoComplete="off"
            placeholder={quick.length ? 'Or type a new name' : 'Your name'} aria-label="Your name"
            onChange={(e) => { setTyped(e.target.value); setPlayer(''); }} />
          {isNew && <small className="hint">New player — “{name.trim()}” will be added.</small>}
        </fieldset>
        <div className="mode-switch" role="group" aria-label="Quiz type">
          <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
            <b>All topics</b><small>Facts and photos, one per animal</small>
          </button>
          <button className={mode === 'animal-sign' ? 'on' : ''} aria-pressed={mode === 'animal-sign'}
            onClick={() => setMode('animal-sign')}>
            <b>Animal signs only</b><small>Which animal does each sign belong to?</small>
          </button>
          <button className={mode === 'pick-sign' ? 'on' : ''} aria-pressed={mode === 'pick-sign'}
            onClick={() => setMode('pick-sign')}>
            <b>Pick the sign</b><small>Given a name, choose the matching sign</small>
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
        <button className="btn big" onClick={start} disabled={busy || dolphins.loading || !name.trim()}>
          {busy ? 'Starting…' : name.trim() ? 'Start quiz' : 'Enter your name to start'}
        </button>
      </div>
    </div>
  );
}
