import { Suspense, lazy } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { MenuBar } from './components/MenuBar';
import './App.css';

// Lazy load components
const AppRoutes = lazy(() => import('./AppRoutes').then(module => ({ default: module.AppRoutes })));

// Loading fallback
const LoadingFallback = () => (
  <div className="loading-spinner"></div>
);

const App = () => {
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <RunTrackerProvider>
              <div className="relative w-full h-full bg-[#111827] text-white">
                <MenuBar />
                <main className="pb-24 max-w-[375px] mx-auto">
                  <Suspense fallback={<LoadingFallback />}>
                    <AppRoutes />
                  </Suspense>
                </main>
              </div>
            </RunTrackerProvider>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
