async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  dolphins: () => request('/dolphins'),
  dolphin: (slug) => request(`/dolphins/${slug}`),
  sourcePages: () => request('/source-pages'),
  startQuiz: (count, mode) =>
    request('/quizzes', { method: 'POST', body: JSON.stringify({ count, mode }) }),
  answer: (quizId, questionId, answer) =>
    request(`/quizzes/${quizId}/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),
  quizzes: () => request('/quizzes'),
  quiz: (id) => request(`/quizzes/${id}`),
};
