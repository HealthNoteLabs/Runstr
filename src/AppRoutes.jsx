import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load all route components
const RunTracker = lazy(() => import('./components/RunTracker').then(module => ({ default: module.RunTracker })));
const RunHistory = lazy(() => import('./pages/RunHistory').then(module => ({ default: module.RunHistory })));
const RunClub = lazy(() => import('./pages/RunClub').then(module => ({ default: module.RunClub })));
const Wallet = lazy(() => import('./pages/Wallet').then(module => ({ default: module.Wallet })));
const Music = lazy(() => import('./pages/Music').then(module => ({ default: module.Music })));
const NWC = lazy(() => import('./pages/NWC').then(module => ({ default: module.NWC })));
const Goals = lazy(() => import('./pages/Goals').then(module => ({ default: module.Goals })));
const Team = lazy(() => import('./pages/Team').then(module => ({ default: module.Team })));
const Events = lazy(() => import('./pages/Events').then(module => ({ default: module.Events })));

// Loading fallback component
const LoadingComponent = () => (
  <div className="loading-spinner"></div>
);

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <Routes>
        <Route path="/history" element={<RunHistory />} />
        <Route path="/club" element={<RunClub />} />
        <Route path="/club/join/:teamId" element={<RunClub />} />
        <Route path="/team" element={<Team />} />
        <Route path="/team/profile/:teamId" element={<Team />} />
        <Route path="/events" element={<Events />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/nwc" element={<NWC />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </Suspense>
  );
};
