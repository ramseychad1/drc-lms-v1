import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Library from './pages/Library.jsx';
import DolphinDetail from './pages/DolphinDetail.jsx';
import Source from './pages/Source.jsx';
import Quiz from './pages/Quiz.jsx';
import History from './pages/History.jsx';
import QuizReview from './pages/QuizReview.jsx';

export default function App() {
  const { pathname } = useLocation();
  const dolphinsActive = pathname === '/' || pathname.startsWith('/dolphins');
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span aria-hidden="true">🐬</span> Dolphin IDs
        </NavLink>
        <nav aria-label="Main">
          <NavLink to="/" className={dolphinsActive ? 'active' : ''}>Dolphins</NavLink>
          <NavLink to="/source">Source Slides</NavLink>
          <NavLink to="/quiz">Quiz</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/dolphins/:slug" element={<DolphinDetail />} />
          <Route path="/source" element={<Source />} />
          <Route path="/source/:page" element={<Source />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<QuizReview />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
