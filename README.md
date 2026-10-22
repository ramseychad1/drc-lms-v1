# DRC Animal Family — learning system

Full-stack study app built from the DRC family slideshow, `resources/Dolphin ID Slideshow.pptx - Google Slides.pdf`.

- **Family profiles** — one page per animal, indexed A–Z with search; all facts plus every photo.
- **Source slides** — the original PDF pages rendered as images, browsable by name; each profile links to its slide.
- **Flashcard quiz** — choose 1–36 questions. Each question is one data point (birth date, parents, origin,
  offspring, rescue date, defining features, or *all* photos of an animal on one card) from a different family member.
  Instant right/wrong feedback; final score with correct / incorrect / percent.
- **History** — every completed quiz with date, score and a full question-by-question review.

Stack: Node 20 + Express, PostgreSQL, React (Vite). One deployable service serves the API and the built UI.

## Local development

```sh
npm run install:all
npm run db            # Postgres on localhost:5436 (docker compose)
npm run dev:server    # API on :3000 — creates tables and loads dolphins on start
npm run dev:client    # UI on :5173 (proxies /api and /content to :3000)
```

Copy `.env.example` to `.env` first (already matches docker-compose).

## Content pipeline

`npm run extract` (needs poppler + Python with Pillow and pypdf) re-reads the PDF and regenerates:

- `data/dolphins.json` — parsed profiles
- `server/content/photos|thumbs|pages` — extracted photos, thumbnails and slide renders

The outputs are committed, so deploys don't need the PDF or poppler. On startup the server upserts
`data/dolphins.json` into Postgres, so content edits only need a redeploy.

Each slide also has a small "object" picture (a frisbee, a pole, …) next to the dolphin photos. These are
stored as *extras*: shown on the profile, never used in quiz photo cards.

## Deploying to Railway

1. Push to GitHub.
2. New project → add **PostgreSQL**, then add a service from the repo (root directory `/`, builder Dockerfile —
   `railway.json` already says so).
3. On the app service set `DATABASE_URL` to a reference of the Postgres service's `DATABASE_URL`
   (`${{Postgres.DATABASE_URL}}`) **before** the first deploy.
4. Settings → Networking → Generate Domain.

The build context is the repo root, so the Dockerfile uses root-relative `COPY` paths. Health check: `/healthz`.

## Notes

- Quiz history is shared by everyone using the deployment (there are no user accounts).
- Source text is kept verbatim, including its typos (e.g. "Lage, lighter fur").
