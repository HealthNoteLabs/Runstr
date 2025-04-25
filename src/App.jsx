import { Suspense, lazy } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { MenuBar } from './components/MenuBar';
import './App.css';

// Lazy load components
const AppRoutes = lazy(() => import('./AppRoutes').then(module => ({ default: module.AppRoutes })));
const FloatingMusicPlayer = lazy(() => import('./components/FloatingMusicPlayer').then(module => ({ default: module.FloatingMusicPlayer })));

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
            <div className="app">
              <MenuBar />
              <main className="main-content">
                <Suspense fallback={<LoadingFallback />}>
                  <AppRoutes />
                </Suspense>
              </main>
              <Suspense fallback={null}>
                <FloatingMusicPlayer />
              </Suspense>
            </div>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
