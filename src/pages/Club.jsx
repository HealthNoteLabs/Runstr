import { Routes, Route } from 'react-router-dom';
import { ClubsList } from '../components/Clubs/ClubsList';
import { ClubCreate } from '../components/Clubs/ClubCreate';
import { ClubDetail } from '../components/Clubs/ClubDetail';
import { lazy, Suspense } from 'react';

// Lazy load the RunClub component for the feed
const RunClub = lazy(() => import('./RunClub').then(module => ({ default: module.RunClub })));

// Loading fallback component
const LoadingComponent = () => (
  <div className="loading-spinner"></div>
);

export const Club = () => {
  return (
    <div className="club-page">
      <Suspense fallback={<LoadingComponent />}>
        <Routes>
          <Route path="/" element={<ClubsList />} />
          <Route path="/create" element={<ClubCreate />} />
          <Route path="/detail/:clubId" element={<ClubDetail />} />
          <Route path="/feed" element={<RunClub />} />
          <Route path="/feed/join/:teamId" element={<RunClub />} />
        </Routes>
      </Suspense>
    </div>
  );
}; 