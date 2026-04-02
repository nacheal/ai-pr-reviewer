import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Review from './pages/Review.jsx';
import Learn from './pages/Learn.jsx';
import Chapter from './pages/Chapter.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/review/:owner/:repo/:pull" element={<Review />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:chapterId" element={<Chapter />} />
      </Routes>
    </BrowserRouter>
  );
}
