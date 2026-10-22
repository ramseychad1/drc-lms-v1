import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const DATA_FILE = fileURLToPath(new URL('../../data/dolphins.json', import.meta.url));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS dolphins (
  id                SERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  page              INT  NOT NULL,
  born_at_drc       BOOLEAN NOT NULL DEFAULT FALSE,
  dob               TEXT,
  parents           TEXT,
  place_of_origin   TEXT,
  offspring         TEXT,
  rescued           TEXT,
  defining_features TEXT
);

CREATE TABLE IF NOT EXISTS dolphin_photos (
  id         SERIAL PRIMARY KEY,
  dolphin_id INT  NOT NULL REFERENCES dolphins(id) ON DELETE CASCADE,
  position   INT  NOT NULL,
  filename   TEXT NOT NULL,
  UNIQUE (dolphin_id, position)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_questions INT NOT NULL,
  correct_count   INT
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id              SERIAL PRIMARY KEY,
  quiz_id         INT  NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position        INT  NOT NULL,
  dolphin_id      INT  NOT NULL REFERENCES dolphins(id),
  field           TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL,
  selected_answer TEXT,
  is_correct      BOOLEAN,
  answered_at     TIMESTAMPTZ,
  UNIQUE (quiz_id, position)
);

-- kind: 'photo' or 'animal-sign' (the symbol shown on the animal's slide). Rows are reloaded on every start.
ALTER TABLE dolphin_photos ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE dolphin_photos DROP COLUMN IF EXISTS is_extra;
-- mode: 'all' (mixed facts) or 'animal-sign' (signs only)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'all';

-- headshot: filename of the face photo used as the animal's thumbnail in the family tree
ALTER TABLE dolphins ADD COLUMN IF NOT EXISTS headshot TEXT;

CREATE INDEX IF NOT EXISTS quizzes_completed_idx ON quizzes (completed_at DESC);
`;

// Idempotent: creates tables and upserts the dolphin content from data/dolphins.json.
export async function migrate() {
  const dolphins = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const d of dolphins) {
      const { rows } = await client.query(
        `INSERT INTO dolphins
           (slug, name, page, born_at_drc, dob, parents, place_of_origin, offspring, rescued, defining_features, headshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name, page = EXCLUDED.page, born_at_drc = EXCLUDED.born_at_drc,
           dob = EXCLUDED.dob, parents = EXCLUDED.parents, place_of_origin = EXCLUDED.place_of_origin,
           offspring = EXCLUDED.offspring, rescued = EXCLUDED.rescued,
           defining_features = EXCLUDED.defining_features, headshot = EXCLUDED.headshot
         RETURNING id`,
        [d.slug, d.name, d.page, d.bornAtDrc, d.dob ?? null, d.parents ?? null,
         d.placeOfOrigin ?? null, d.offspring ?? null, d.rescued ?? null, d.definingFeatures ?? null, d.headshot ?? null],
      );
      const id = rows[0].id;
      await client.query('DELETE FROM dolphin_photos WHERE dolphin_id = $1', [id]);
      const images = [...d.photos.map((f) => [f, 'photo']), ...(d.animalSigns ?? []).map((f) => [f, 'animal-sign'])];
      for (const [i, [filename, kind]] of images.entries()) {
        await client.query(
          'INSERT INTO dolphin_photos (dolphin_id, position, filename, kind) VALUES ($1,$2,$3,$4)',
          [id, i + 1, filename, kind],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Database ready: ${dolphins.length} dolphins loaded`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
