import { Routes, Route, Navigate } from 'react-router-dom';
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
  
  return (
    <div className="club-page">
      <Suspense fallback={<LoadingComponent />}>
        <Routes>
          {/* Club specific routes */}
          <Route path="/" element={<ClubsList />} />
          <Route path="/create" element={<ClubCreate />} />
          <Route path="/detail/:clubId" element={<ClubDetail />} />
          
          {/* Feed specific routes */}
          <Route path="/feed" element={<RunClub />} />
          <Route path="/feed/join/:teamId" element={<RunClub />} />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      
      {/* Show error UI if loading fails */}
      {loadError && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">Loading Error</h2>
            <p className="text-gray-300 mb-6">There was a problem loading this page. Please try again.</p>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg"
              >
                Reload Page
              </button>
              <a 
                href="/"
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 