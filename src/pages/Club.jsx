import { Routes, Route, useNavigate } from 'react-router-dom';
import { ClubsList } from '../components/Clubs/ClubsList';
import { ClubCreate } from '../components/Clubs/ClubCreate';
import { ClubDetail } from '../components/Clubs/ClubDetail';
import { lazy, Suspense, useState, useEffect } from 'react';

// Lazy load the RunClub component for the feed
const RunClub = lazy(() => import('./RunClub').then(module => ({ default: module.RunClub })));

// Loading fallback component
const LoadingComponent = () => (
  <div className="flex flex-col items-center justify-center p-8">
    <div className="loading-spinner mb-4"></div>
    <p className="text-gray-400">Loading...</p>
  </div>
);

export const Club = () => {
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState(false);
  
  // Add a timeout to detect if the component fails to load
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Check if we're still showing the loading indicator
      const loadingEl = document.querySelector('.loading-spinner');
      if (loadingEl) {
        setLoadError(true);
      }
    }, 20000); // 20 seconds timeout
    
    return () => clearTimeout(timeout);
  }, []);
  
  // If there's a loading error, show a recovery UI
  if (loadError) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Unable to Load Clubs</h2>
        <p className="text-gray-400 mb-6">We're having trouble loading the running clubs. This could be due to network issues or relay connection problems.</p>
        <div className="flex flex-col space-y-4">
          <button 
            onClick={() => navigate('/club/', { replace: true })}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
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