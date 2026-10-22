export default function Status({ loading, error, children }) {
  if (loading) return <p className="empty" role="status">Loading…</p>;
  if (error) return <p className="empty error" role="alert">Something went wrong: {error.message}</p>;
  return children;
}
