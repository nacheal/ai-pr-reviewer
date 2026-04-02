import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Review from './pages/Review.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/review/:owner/:repo/:pull" element={<Review />} />
      </Routes>
    </BrowserRouter>
  );
}
