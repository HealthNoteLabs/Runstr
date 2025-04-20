import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { TeamsProvider } from './contexts/TeamsContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { MenuBar } from './components/MenuBar';
import DevTools from './components/DevTools';
import { initializeNostr } from './utils/nostr';
import { initMobileServices, setupAppEventListeners } from './services/MobileService';
import { isNativePlatform } from './utils/platform';
import './App.css';

console.log("App.jsx is loading");

// Improved error boundary fallback
const ErrorFallback = ({ error }) => (
  <div className="p-6 bg-red-900/30 border border-red-800 rounded-lg m-4">
    <h2 className="text-2xl font-bold text-white mb-4">App Loading Error</h2>
    <p className="text-red-300 mb-4">
      There was a problem loading the app. This could be due to network issues or a problem with the app itself.
    </p>
    {error && (
      <div className="bg-red-950/30 p-3 rounded mb-4 overflow-auto max-h-40">
        <p className="text-red-200 text-sm font-mono">{error.toString()}</p>
      </div>
    )}
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
    >
      Reload App
    </button>
  </div>
);

// Enhanced loading component with timeout detection
const EnhancedLoadingFallback = () => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [extendedTimeout, setExtendedTimeout] = useState(false);
  
  useEffect(() => {
    // After 5 seconds of loading, show a timeout warning
    const timeoutId = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5000);
    
    // After 15 seconds, show extended timeout warning
    const extendedTimeoutId = setTimeout(() => {
      setExtendedTimeout(true);
    }, 15000);
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(extendedTimeoutId);
    };
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-300">Loading RUNSTR...</p>
      
      {showTimeoutWarning && (
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg max-w-md">
          <p className="text-yellow-300 text-center mb-2">
            Loading is taking longer than expected. Please be patient.
          </p>
          <p className="text-yellow-400 text-sm text-center">
            If this persists, try reloading the app.
          </p>
        </div>
      )}
      
      {extendedTimeout && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg max-w-md">
          <p className="text-red-300 text-center mb-2">
            Loading timeout exceeded. There may be an initialization issue.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
          >
            Reload App
          </button>
        </div>
      )}
    </div>
  );
};

// Direct component for when AppRoutes fails to load
const FallbackHomeScreen = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">Welcome to RUNSTR</h2>
    <p className="mb-4">The main application screens could not be loaded.</p>
    <p className="mb-4">This might be caused by a permissions issue or initialization problem.</p>
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
    >
      Retry Loading
    </button>
  </div>
);

// Lazy load AppRoutes with error handling
const AppRoutes = lazy(() => 
  import('./AppRoutes')
    .then(module => {
      console.log("AppRoutes module loaded successfully");
      return { default: module.default || module.AppRoutes };
    })
    .catch(error => {
      console.error("Error loading AppRoutes:", error);
      return { 
        default: () => <ErrorFallback error={error} /> 
      };
    })
);

const App = () => {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [showDevTools, setShowDevTools] = useState(process.env.NODE_ENV === 'development' && !isNativePlatform);
  
  // Initialize mobile services and Nostr as soon as the app launches
  useEffect(() => {
    console.log('Starting app initialization process');
    
    const initializeApp = async () => {
      try {
        // Initialize mobile services first
        console.log('Initializing mobile services...');
        const mobileServicesResult = await initMobileServices();
        console.log('Mobile services initialization result:', mobileServicesResult);
        
        // Set up app event listeners
        console.log('Setting up app event listeners...');
        const cleanupListeners = setupAppEventListeners();
        
        // Initialize Nostr
        console.log('Preloading Nostr connection on app launch');
        try {
          await initializeNostr();
          console.log('Nostr initialization complete');
        } catch (nostrError) {
          console.error('Nostr initialization failed but continuing:', nostrError);
          // We'll continue even if Nostr fails - it's not critical for app startup
        }
        
        // Prefetch run feed data using dynamic import to avoid circular dependencies
        try {
          const { fetchRunningPosts } = await import('./utils/nostr');
          console.log('Preloading feed data in background');
          fetchRunningPosts(10).catch(err => 
            console.error('Error preloading feed data:', err)
          );
        } catch (error) {
          console.error('Error importing feed functions:', error);
          // Not critical for initialization
        }
        
        console.log('Initialization process complete');
        setInitializationComplete(true);
        
        return () => {
          // Clean up event listeners
          cleanupListeners();
        };
      } catch (error) {
        console.error('Error initializing app:', error);
        setErrorDetails(error);
        setHasError(true);
      }
    };
    
    initializeApp();
    
    // Dev tools keyboard shortcut - only available in development mode and not on native mobile
    if (process.env.NODE_ENV === 'development' && !isNativePlatform) {
      const handleKeyDown = (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          setShowDevTools(prev => !prev);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);
  
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setErrorDetails(event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  
  if (hasError) {
    return <ErrorFallback error={errorDetails} />;
  }
  
  // If we're on Android and initialization hasn't completed in 10 seconds, render a simple UI anyway
  const [forceRender, setForceRender] = useState(false);
  useEffect(() => {
    if (isNativePlatform && !initializationComplete) {
      const timeoutId = setTimeout(() => {
        console.log('Forcing render after timeout');
        setForceRender(true);
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [initializationComplete]);
  
  return (
    <Router>
      <NostrProvider>
        <div className="relative w-full h-full bg-[#111827] text-white">
          {/* Render basic app shell even if providers fail */}
          <SettingsProvider>
            <ActivityModeProvider>
              <AuthProvider>
                <AudioPlayerProvider>
                  <RunTrackerProvider>
                    <TeamsProvider>
                      <MenuBar />
                      <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                        {(initializationComplete || forceRender) ? (
                          <Suspense fallback={<EnhancedLoadingFallback />}>
                            <AppRoutes />
                          </Suspense>
                        ) : (
                          <EnhancedLoadingFallback />
                        )}
                      </main>
                      {showDevTools && <DevTools />}
                    </TeamsProvider>
                  </RunTrackerProvider>
                </AudioPlayerProvider>
              </AuthProvider>
            </ActivityModeProvider>
          </SettingsProvider>
        </div>
      </NostrProvider>
    </Router>
  );
};

export default App;
