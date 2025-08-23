import { Suspense, lazy, useEffect, useState, useContext } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrContext.jsx';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { TeamsProvider } from './contexts/TeamsContext';
import { TeamChallengeProvider } from './contexts/TeamChallengeContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { WalletProvider } from './contexts/WalletContext';
import { MenuBar } from './components/MenuBar';
import { initializeEvents } from './services/EventService';
import './App.css';
import ErrorFallback from './components/ErrorFallback';
import { directFetchRunningPosts } from './utils/feedFetcher';
import { lightweightProcessPosts } from './utils/feedProcessor';
import { storeFeedCache, isCacheFresh } from './utils/feedCache';
import { NostrContext } from './contexts/NostrContext.jsx';
import './utils/errorSilencer';
import { Toaster } from 'react-hot-toast';
import SafePullToRefresh from './components/SafePullToRefresh';
import AuthService from './services/AuthService';
import AmberLoginModal from './components/AmberLoginModal';

console.log("App.jsx is loading");

// Improved error boundary fallback
const EnhancedLoadingFallback = () => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  useEffect(() => {
    // After 5 seconds of loading, show a timeout warning
    const timeoutId = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg-primary">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      <p className="text-text-secondary">Loading RUNSTR...</p>
      
      {showTimeoutWarning && (
        <div className="mt-8 p-4 bg-warning-light border border-warning rounded-lg max-w-md">
          <p className="text-warning text-center mb-2">
            Loading is taking longer than expected. Please be patient.
          </p>
          <p className="text-warning text-sm text-center">
            If this persists, try reloading the app.
          </p>
        </div>
      )}
    </div>
  );
};

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
        default: () => <ErrorFallback /> 
      };
    })
);

const App = () => {
  const [hasError, setHasError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Phase 2: Basic refresh using existing proven mechanisms
  const handleAppRefresh = async () => {
    console.log('App refresh triggered - Phase 2 (basic refresh)');
    
    try {
      // Clear cached feed data using existing mechanism
      if (window.__PRELOADED_FEED) {
        delete window.__PRELOADED_FEED;
        console.log('Cleared preloaded feed cache');
      }
      
      // Clear feed loading flag to allow fresh fetch
      if (window.__FEED_LOADING) {
        window.__FEED_LOADING = false;
        console.log('Reset feed loading flag');
      }
      
      // Trigger existing refresh events that components already listen for
      document.dispatchEvent(new Event('runHistoryUpdated'));
      console.log('Triggered runHistoryUpdated event');
      
      // Brief delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('App refresh completed successfully');
    } catch (error) {
      console.warn('App refresh error (app continues normally):', error);
    }
  };
  
  // Initialize app services
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app services');
        
        // Initialize events with test event - moved higher in init sequence
        // and clearing any potential dismiss flags to ensure visibility
        localStorage.removeItem('eventBannerDismissedUntil');
        initializeEvents();
        console.log('Events initialized');
        
        // REMOVE: await initializeNostr();
        // NDK initialization is now handled by the NDKSingleton and NostrProvider
        // The NostrProvider will await the ndkReadyPromise from the singleton.
        console.log('NDK initialization is managed by NDKSingleton and NostrProvider.');
        
        // First check if we have a fresh cache that can be used immediately
        // Note: We check for cache freshness but don't need to assign the variable if not using it
        isCacheFresh(30); // Check if cache is less than 30 minutes old
        
        // If cache isn't fresh enough, use optimized feed fetcher for fast initial load
        if (!isCacheFresh(5) && !window.__FEED_LOADING) {
          window.__FEED_LOADING = true;
          
          console.log('Starting background feed preload');
          // Use the new direct fetch with aggressive timeout
          directFetchRunningPosts(10, 7)
            .then(posts => {
              if (posts && posts.length > 0) {
                console.log(`Preloaded ${posts.length} posts, processing...`);
                
                // Use lightweight processor for fast processing
                const processedPosts = lightweightProcessPosts(posts);
                
                // Cache the results for immediate use when user navigates to feed
                storeFeedCache(processedPosts, 30);
                
                // Store in global context for immediate access
                window.__PRELOADED_FEED = processedPosts;
                
                // Now that we have basic data displayed, fetch supplementary data in background
                // We'll use dynamic import to avoid circular dependencies
                import('./utils/nostr').then(({ loadSupplementaryData, processPostsWithData }) => {
                  console.log('Loading supplementary data in background...');
                  loadSupplementaryData(posts)
                    .then(supplementaryData => {
                      // Process the full data
                      return processPostsWithData(posts, supplementaryData);
                    })
                    .then(enrichedPosts => {
                      // Cache the enriched posts
                      storeFeedCache(enrichedPosts, 60);
                      // Update the global reference
                      window.__PRELOADED_FEED = enrichedPosts;
                      console.log('Background feed enrichment completed');
                    })
                    .catch(err => console.error('Background enrichment error:', err))
                    .finally(() => {
                      window.__FEED_LOADING = false;
                    });
                });
              }
            })
            .catch(err => {
              console.error('Error preloading feed data:', err);
              window.__FEED_LOADING = false;
            });
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initializeApp();
  }, []);

  // Check authentication status on app start
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = AuthService.isAuthenticated();
      setIsAuthenticated(isAuth);
      setAuthChecked(true);
      console.log('[App] Authentication status checked:', isAuth);
    };
    
    checkAuth();
  }, []);

  // Handle successful login
  const handleLoginSuccess = (pubkey) => {
    console.log('[App] Login successful:', pubkey.substring(0, 8) + '...');
    setIsAuthenticated(true);
    // Trigger a reload of the app to reinitialize contexts with the new auth state
    window.location.reload();
  };
  
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  
  if (hasError) {
    return <ErrorFallback />;
  }
  
  // Show loading while checking authentication
  if (!authChecked) {
    return <EnhancedLoadingFallback />;
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <AmberLoginModal 
          onSuccess={handleLoginSuccess}
          onCancel={() => {
            // For now, just refresh the page if user cancels
            // In the future, we might want to show an offline mode
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <SettingsProvider>
              <ActivityModeProvider>
                <RunTrackerProvider>
                  <TeamsProvider>
                    <TeamChallengeProvider>
                      <WalletProvider>
                        <div className="relative w-full min-h-screen bg-bg-primary text-text-primary">
                          <MenuBar />
                          <SafePullToRefresh onRefresh={handleAppRefresh}>
                            <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                              <Suspense fallback={<EnhancedLoadingFallback />}>
                                <AppRoutes />
                              </Suspense>
                            </main>
                          </SafePullToRefresh>
                          <Toaster 
                            position="top-center"
                            toastOptions={{
                              // Default styles for all toasts
                              style: {
                                background: '#000000',
                                color: '#ffffff',
                                border: '1px solid #ffffff',
                                borderRadius: '8px',
                                fontSize: '14px',
                                padding: '12px 16px',
                                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
                              },
                              // Pure black/white theme - no colored icons
                              iconTheme: {
                                primary: '#ffffff',
                                secondary: '#000000',
                              },
                              duration: 3000,
                              // Override specific toast types to maintain black/white theme
                              success: {
                                style: {
                                  background: '#000000',
                                  color: '#ffffff',
                                  border: '1px solid #ffffff',
                                },
                                iconTheme: {
                                  primary: '#ffffff',
                                  secondary: '#000000',
                                },
                              },
                              error: {
                                style: {
                                  background: '#000000',
                                  color: '#ffffff',
                                  border: '1px solid #ffffff',
                                },
                                iconTheme: {
                                  primary: '#ffffff',
                                  secondary: '#000000',
                                },
                              },
                              loading: {
                                style: {
                                  background: '#000000',
                                  color: '#ffffff',
                                  border: '1px solid #ffffff',
                                },
                                iconTheme: {
                                  primary: '#ffffff',
                                  secondary: '#000000',
                                },
                              },
                            }}
                          />
                        </div>
                      </WalletProvider>
                    </TeamChallengeProvider>
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
