import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AudioPlayerProvider } from './components/AudioPlayerProvider';
import { Home } from './pages/Home';
import { RunTracker } from './components/RunTracker';
import { RunHistory } from './pages/RunHistory';
import { Feed } from './pages/Feed';
import { Profile } from './pages/Profile';
import { Navigation } from './components/Navigation';
import { FeedsView } from './pages/FeedsView';
import { WavlakePlayer } from './components/WavlakePlayer';
import { Goals } from './pages/Goals';

// Import the RunDataManager to initialize it
import './services/RunDataManager';

export function App() {
  // Initialize any required state or listeners
  useEffect(() => {
    // Set default distance unit if not set
    if (!localStorage.getItem('distanceUnit')) {
      localStorage.setItem('distanceUnit', 'km');
    }
    
    // Add Android back button handler
    const handleBackButton = () => {
      if (window.location.pathname !== '/') {
        window.history.back();
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior (exit app)
    };
    
    // Add the handler if we're in Android WebView
    if (window.Android && window.Android.addBackButtonHandler) {
      window.Android.addBackButtonHandler(handleBackButton);
    }
    
    return () => {
      // Clean up listeners if needed
    };
  }, []);

  return (
    <NostrProvider>
      <AudioPlayerProvider>
        <div className="app-container">
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/run" element={<RunTracker />} />
              <Route path="/history" element={<RunHistory />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/feeds" element={<FeedsView />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/goals" element={<Goals />} />
            </Routes>
          </main>
          <WavlakePlayer />
          <Navigation />
        </div>
      </AudioPlayerProvider>
    </NostrProvider>
  );
}
