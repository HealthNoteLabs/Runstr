import { lazy, Suspense, useState, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

console.log("AppRoutes.jsx is being executed");

// Fallback component for when imports fail
const ErrorFallback = ({ componentName }) => (
  <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg m-4">
    <h2 className="text-xl font-bold text-white mb-2">Error Loading Component</h2>
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
const TeamDetail = safeLazy(() => import('./pages/TeamDetail'), 'TeamDetail');
const Profile = safeLazy(() => import('./pages/Profile'), 'Profile');
const About = safeLazy(() => import('./pages/About'), 'About');
const GroupDiscoveryScreen = safeLazy(() => import('./components/GroupDiscoveryScreen'), 'GroupDiscoveryScreen');

// Loading component to show while lazy loading
const LoadingComponent = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/about" element={<About />} />
        
        {/* Teams routes */}
        <Route path="/teams" element={<GroupDiscoveryScreen />} />
        <Route path="/teams/:teamId" element={<TeamDetail />} />
        
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
