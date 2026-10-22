import { Router } from 'express';
import { pool, query } from './db.js';
import { buildQuestions, MODES } from './quiz.js';

export const api = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const photoUrls = (filenames) =>
  filenames.map((f) => ({ url: `/content/photos/${f}`, thumb: `/content/thumbs/${f}` }));

const DOLPHIN_SELECT = `
  SELECT d.*,
         COALESCE(array_agg(p.filename ORDER BY p.position) FILTER (WHERE p.kind = 'photo'), '{}') AS photos,
         COALESCE(array_agg(p.filename ORDER BY p.position) FILTER (WHERE p.kind = 'animal-sign'), '{}') AS signs
    FROM dolphins d
    LEFT JOIN dolphin_photos p ON p.dolphin_id = d.id`;

const toDolphin = (r) => ({
  slug: r.slug,
  name: r.name,
  page: r.page,
  bornAtDrc: r.born_at_drc,
  dob: r.dob,
  parents: r.parents,
  placeOfOrigin: r.place_of_origin,
  offspring: r.offspring,
  rescued: r.rescued,
  definingFeatures: r.defining_features,
  headshot: r.headshot ? photoUrls([r.headshot])[0] : null,
  photos: photoUrls(r.photos),
  animalSigns: photoUrls(r.signs),
});

// ---- Content -------------------------------------------------------------

api.get('/dolphins', wrap(async (_req, res) => {
  const { rows } = await query(`${DOLPHIN_SELECT} GROUP BY d.id ORDER BY lower(d.name)`);
  res.json(rows.map(toDolphin));
}));

api.get('/dolphins/:slug', wrap(async (req, res) => {
  const { rows } = await query(`${DOLPHIN_SELECT} WHERE d.slug = $1 GROUP BY d.id`, [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ error: 'Family member not found' });
  res.json(toDolphin(rows[0]));
}));

// Source slides: page 1 is the title slide, every other page belongs to a dolphin.
api.get('/source-pages', wrap(async (_req, res) => {
  const { rows } = await query('SELECT slug, name, page FROM dolphins ORDER BY page');
  const pad = (n) => String(n).padStart(2, '0');
  res.json([
    { page: 1, title: 'Title slide', slug: null, image: '/content/pages/page-01.jpg' },
    ...rows.map((r) => ({
      page: r.page, title: r.name, slug: r.slug, image: `/content/pages/page-${pad(r.page)}.jpg`,
    })),
  ]);
}));

// ---- Quiz ----------------------------------------------------------------

const IMAGE_KIND = { photos: 'photo', 'animal-sign': 'animal-sign' };

const publicQuestion = async (q) => {
  const out = { id: q.id, position: q.position, field: q.field, prompt: q.prompt, options: q.options };
  if (IMAGE_KIND[q.field]) {
    const { rows } = await query(
      'SELECT filename FROM dolphin_photos WHERE dolphin_id = $1 AND kind = $2 ORDER BY position',
      [q.dolphin_id, IMAGE_KIND[q.field]]);
    out.photos = photoUrls(rows.map((r) => r.filename));
  }
  return out;
};

api.post('/quizzes', wrap(async (req, res) => {
  const { rows: dolphins } = await query(`
    SELECT d.*,
           (SELECT count(*)::int FROM dolphin_photos p WHERE p.dolphin_id = d.id AND p.kind = 'photo') AS photo_count,
           (SELECT count(*)::int FROM dolphin_photos p WHERE p.dolphin_id = d.id AND p.kind = 'animal-sign') AS sign_count
      FROM dolphins d`);
  const mode = req.body?.mode ?? 'all';
  if (!MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of ${MODES.join(', ')}` });
  const requested = Number.parseInt(req.body?.count, 10);
  if (!Number.isInteger(requested) || requested < 1) {
    return res.status(400).json({ error: 'count must be a positive integer' });
  }
  const questions = buildQuestions(dolphins, requested, mode);
  const count = questions.length;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [quiz] } = await client.query(
      'INSERT INTO quizzes (total_questions, mode) VALUES ($1, $2) RETURNING id, created_at', [count, mode]);
    const saved = [];
    for (const [i, q] of questions.entries()) {
      const { rows: [row] } = await client.query(
        `INSERT INTO quiz_questions (quiz_id, position, dolphin_id, field, prompt, options, correct_answer)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [quiz.id, i + 1, q.dolphinId, q.field, q.prompt, JSON.stringify(q.options), q.correctAnswer]);
      saved.push(row);
    }
    await client.query('COMMIT');
    res.status(201).json({
      id: quiz.id,
      mode,
      total: count,
      questions: await Promise.all(saved.map(publicQuestion)),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

api.post('/quizzes/:id/questions/:qid/answer', wrap(async (req, res) => {
  const { answer } = req.body ?? {};
  if (typeof answer !== 'string') return res.status(400).json({ error: 'answer is required' });

  const { rows: [q] } = await query(
    `SELECT qq.*, d.slug, d.page FROM quiz_questions qq JOIN dolphins d ON d.id = qq.dolphin_id
      WHERE qq.id = $1 AND qq.quiz_id = $2`, [req.params.qid, req.params.id]);
  if (!q) return res.status(404).json({ error: 'Question not found' });

  let { selected_answer: selected, is_correct: correct } = q;
  if (selected === null) {
    // First answer wins; a repeated request just returns the stored result.
    selected = answer;
    correct = answer === q.correct_answer;
    await query(
      'UPDATE quiz_questions SET selected_answer = $1, is_correct = $2, answered_at = now() WHERE id = $3',
      [selected, correct, q.id]);
  }

  const { rows: [tally] } = await query(
    `SELECT count(*) FILTER (WHERE selected_answer IS NOT NULL)::int AS answered,
            count(*) FILTER (WHERE is_correct)::int AS correct,
            count(*)::int AS total
       FROM quiz_questions WHERE quiz_id = $1`, [q.quiz_id]);
  const complete = tally.answered === tally.total;
  if (complete) {
    await query(
      `UPDATE quizzes SET completed_at = COALESCE(completed_at, now()), correct_count = $2 WHERE id = $1`,
      [q.quiz_id, tally.correct]);
  }
  res.json({
    correct,
    selectedAnswer: selected,
    correctAnswer: q.correct_answer,
    dolphin: { slug: q.slug, page: q.page },
    quizComplete: complete,
  });
}));

const summarize = (r) => ({
  id: r.id,
  mode: r.mode,
  createdAt: r.created_at,
  completedAt: r.completed_at,
  total: r.total_questions,
  correct: r.correct_count,
  incorrect: r.total_questions - r.correct_count,
  percent: Math.round((r.correct_count / r.total_questions) * 100),
});

api.get('/quizzes', wrap(async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM quizzes WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 200');
  res.json(rows.map(summarize));
}));

api.get('/quizzes/:id', wrap(async (req, res) => {
  const { rows: [quiz] } = await query(
    'SELECT * FROM quizzes WHERE id = $1 AND completed_at IS NOT NULL', [req.params.id]);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const { rows } = await query(
    `SELECT qq.*, d.slug, d.name AS dolphin_name, d.page,
            COALESCE((SELECT array_agg(p.filename ORDER BY p.position)
                        FROM dolphin_photos p WHERE p.dolphin_id = d.id
                         AND p.kind = CASE qq.field WHEN 'animal-sign' THEN 'animal-sign' ELSE 'photo' END), '{}') AS photos
       FROM quiz_questions qq JOIN dolphins d ON d.id = qq.dolphin_id
      WHERE qq.quiz_id = $1 ORDER BY qq.position`, [quiz.id]);
  res.json({
    ...summarize(quiz),
    questions: rows.map((q) => ({
      position: q.position,
      field: q.field,
      prompt: q.prompt,
      selectedAnswer: q.selected_answer,
      correctAnswer: q.correct_answer,
      isCorrect: q.is_correct,
      dolphin: { slug: q.slug, name: q.dolphin_name, page: q.page },
      photos: IMAGE_KIND[q.field] ? photoUrls(q.photos) : undefined,
    })),
  });
}));
