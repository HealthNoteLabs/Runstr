import { lazy, Suspense, useState, useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

console.log("AppRoutes.jsx is being executed");

// Fallback component for when imports fail
const ErrorFallback = ({ componentName }) => (
  <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg m-4">
    <h2 className="section-heading mb-2">Error Loading Component</h2>
    <p className="text-red-300">Failed to load the {componentName} component.</p>
  </div>
);

// Helper to safely load components with better error handling
const safeLazy = (importer, componentName) => {
  return lazy(() => 
    importer()
      .then(module => {
        console.log(`Successfully loaded ${componentName}`);
        if (module.default) return { default: module.default };
        // Handle named exports
        const namedExport = module[componentName];
        if (namedExport) return { default: namedExport };
        // Last resort - return whatever we got
        return { default: Object.values(module)[0] || (() => <ErrorFallback componentName={componentName} />) };
      })
      .catch(error => {
        console.error(`Error loading ${componentName}:`, error);
        return {
          default: () => <ErrorFallback componentName={componentName} />
        };
      })
  );
};

// Lazy load components with better error handling
const RunTracker = safeLazy(() => import('./components/RunTracker'), 'RunTracker');
const RunHistory = safeLazy(() => import('./pages/RunHistory'), 'RunHistory');
const RunClub = safeLazy(() => import('./pages/RunClub'), 'RunClub');
const Wallet = safeLazy(() => import('./pages/Wallet'), 'Wallet');
const Music = safeLazy(() => import('./pages/Music'), 'Music');
const NWC = safeLazy(() => import('./pages/NWC'), 'NWC');
// const EcashWallet = safeLazy(() => import('./pages/EcashWallet'), 'EcashWallet'); // Temporarily disabled
const Goals = safeLazy(() => import('./pages/Goals'), 'Goals');
const EventsPage = safeLazy(() => import('./pages/EventsPage'), 'EventsPage');
const EventDetail = safeLazy(() => import('./pages/EventDetail'), 'EventDetail');
const Profile = safeLazy(() => import('./pages/Profile'), 'Profile');
const NostrStatsPage = safeLazy(() => import('./pages/NostrStatsPage'), 'NostrStatsPage');
const TeamsPage = safeLazy(() => import('./pages/TeamsPage'), 'TeamsPage');
const CreateTeamFormV2 = safeLazy(() => import('./components/teams/CreateTeamFormV2'), 'CreateTeamFormV2');
const TeamDetailPage = safeLazy(() => import('./pages/TeamDetailPage'), 'TeamDetailPage');
const TeamEventDetailPage = safeLazy(() => import('./pages/TeamEventDetailPage'), 'TeamEventDetailPage');
const ChallengeDetailPage = safeLazy(() => import('./pages/ChallengeDetailPage'), 'ChallengeDetailPage');

// Loading component to show while lazy loading
const LoadingComponent = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const AppRoutes = () => {
  console.log("AppRoutes component is rendering");
  const [isErrorLogged, setIsErrorLogged] = useState(false);

  // Add global error handler to catch any unhandled errors
  useEffect(() => {
    if (!isErrorLogged) {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        setIsErrorLogged(true);
        originalConsoleError(...args);
      };
      
      return () => {
        console.error = originalConsoleError;
      };
    }
  }, [isErrorLogged]);
  
  return (
    <Suspense fallback={<LoadingComponent />}>
      <Routes>
        <Route path="/history" element={<RunHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/club" element={<RunClub />} />
        <Route path="/nwc" element={<NWC />} />
        {/* Ecash wallet route temporarily disabled - redirect to wallet page */}
        <Route path="/ecash" element={<Navigate to="/wallet" replace />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/event/:eventId" element={<EventDetail />} />
        
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/new" element={<CreateTeamFormV2 />} />
        <Route path="/teams/:captainPubkey/:teamUUID" element={<TeamDetailPage />} />
        <Route path="/teams/:captainPubkey/:teamUUID/event/:eventId" element={<TeamEventDetailPage />} />
        <Route path="/challenge/:captainPubkey/:challengeUUID" element={<ChallengeDetailPage />} />
        
        <Route path="/nostr-stats" element={<NostrStatsPage />} />
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
