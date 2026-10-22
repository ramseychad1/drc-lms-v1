// Quiz question generation. One data point per question; multi-part facts
// (e.g. both parents, all defining features) are kept together as one answer.

const OPTION_COUNT = 4;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// "Unknown" on its own (or "Unknown (rescue)") isn't a fair thing to quiz on.
const isUnknown = (v) => !v || (/^unknown/i.test(v) && !/\d/.test(v));

// Each field: how to read the answer off a dolphin, and how to phrase the question.
export const FIELDS = {
  dob: {
    answer: (d) => (isUnknown(d.dob) ? null : d.dob),
    prompt: (d) => `What is ${d.name}'s date of birth?`,
  },
  parents: {
    answer: (d) => (isUnknown(d.parents) ? null : d.parents),
    prompt: (d) => `Who are ${d.name}'s parents?`,
  },
  origin: {
    answer: (d) => (d.born_at_drc ? 'Born at DRC' : d.place_of_origin || null),
    prompt: (d) => `Where did ${d.name} come from?`,
  },
  offspring: {
    answer: (d) => d.offspring || null,
    prompt: (d) => `Which offspring does ${d.name} have?`,
  },
  rescued: {
    answer: (d) => d.rescued || null,
    prompt: (d) => `When was ${d.name} rescued?`,
  },
  features: {
    answer: (d) => d.defining_features || null,
    prompt: (d) => `Which describes ${d.name}'s defining features?`,
  },
  photos: {
    answer: (d) => (d.photo_count > 0 ? d.name : null),
    prompt: () => 'Which dolphin is shown in these photos?',
  },
};

export function buildQuestions(dolphins, count) {
  const chosen = shuffle(dolphins).slice(0, count);
  return chosen.map((d) => {
    const available = Object.keys(FIELDS).filter((f) => FIELDS[f].answer(d));
    const field = available[Math.floor(Math.random() * available.length)];
    const correct = FIELDS[field].answer(d);

    const pool = new Set();
    for (const other of dolphins) {
      if (other.id === d.id) continue;
      const a = FIELDS[field].answer(other);
      if (a && a.toLowerCase() !== correct.toLowerCase()) pool.add(a);
    }
    const distractors = shuffle([...pool]).slice(0, OPTION_COUNT - 1);

    return {
      dolphinId: d.id,
      field,
      prompt: FIELDS[field].prompt(d),
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  });
}
