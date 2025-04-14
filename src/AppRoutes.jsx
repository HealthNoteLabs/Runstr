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
const Teams = lazy(() => import('./pages/Teams').then(module => ({ default: module.Teams })));
const TeamDetail = lazy(() => import('./pages/TeamDetail').then(module => ({ default: module.TeamDetail })));
const TeamCreate = lazy(() => import('./pages/TeamCreate').then(module => ({ default: module.TeamCreate })));
const Events = lazy(() => import('./pages/Events').then(module => ({ default: module.Events })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));

// Loading fallback component - removed spinner
const LoadingComponent = () => (
  <div></div>
);

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <Routes>
        <Route path="/history" element={<RunHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/club" element={<RunClub />} />
        <Route path="/club/join/:teamId" element={<RunClub />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/create" element={<TeamCreate />} />
        <Route path="/teams/:teamId" element={<TeamDetail />} />
        <Route path="/events" element={<Events />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/nwc" element={<NWC />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/about" element={<About />} />
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </Suspense>
  );
};
