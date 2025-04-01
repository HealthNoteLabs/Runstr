import { Routes, Route } from 'react-router-dom';
import { RunTracker } from './components/RunTracker';
import { RunHistory } from './pages/RunHistory';
import { Goals } from './pages/Goals';
import { Profile } from './pages/Profile';
import { RunClubs } from './pages/RunClubs';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RunTracker />} />
      <Route path="/history" element={<RunHistory />} />
      <Route path="/goals" element={<Goals />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/club" element={<RunClubs />} />
    </Routes>
  );
};
