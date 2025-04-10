import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { TeamsProvider } from './contexts/TeamsContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { MenuBar } from './components/MenuBar';
import { initializeNostr } from './utils/nostr';
import './App.css';

// Lazy load components
const AppRoutes = lazy(() => import('./AppRoutes').then(module => ({ default: module.AppRoutes })));

// Loading fallback - removed spinner
const LoadingFallback = () => (
  <div></div>
);

const App = () => {
  // Initialize Nostr connection as soon as the app launches
  useEffect(() => {
    const preloadNostr = async () => {
      console.log('Preloading Nostr connection on app launch');
      await initializeNostr();
      
      // Prefetch run feed data using dynamic import to avoid circular dependencies
      try {
        const { fetchRunningPosts } = await import('./utils/nostr');
        console.log('Preloading feed data in background');
        fetchRunningPosts(10).catch(err => 
          console.error('Error preloading feed data:', err)
        );
      } catch (error) {
        console.error('Error importing feed functions:', error);
      }
    };
    
    preloadNostr();
  }, []);
  
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <SettingsProvider>
              <ActivityModeProvider>
                <RunTrackerProvider>
                  <TeamsProvider>
                    <div className="relative w-full h-full bg-[#111827] text-white">
                      <MenuBar />
                      <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                        <Suspense fallback={<LoadingFallback />}>
                          <AppRoutes />
                        </Suspense>
                      </main>
                    </div>
                  </TeamsProvider>
                </RunTrackerProvider>
              </ActivityModeProvider>
            </SettingsProvider>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
