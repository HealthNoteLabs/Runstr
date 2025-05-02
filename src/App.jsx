import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { WalletProvider } from './contexts/WalletContext';
import { MenuBar } from './components/MenuBar';
import { initializeNostr } from './utils/nostr';
import './App.css';
import ErrorFallback from './components/ErrorFallback';
import { directFetchRunningPosts } from './utils/feedFetcher';
import { lightweightProcessPosts } from './utils/feedProcessor';
import { storeFeedCache, getFeedCache, isCacheFresh } from './utils/feedCache';
import GroupsProvider from './contexts/GroupsContext';

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
  
  // Initialize Nostr connection as soon as the app launches
  useEffect(() => {
    const preloadNostr = async () => {
      try {
        console.log('Preloading Nostr connection on app launch');
        await initializeNostr();
        
        // First check if we have a fresh cache that can be used immediately
        const cachedFeed = getFeedCache(30); // Get cache if less than 30 minutes old
        
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
        console.error('Error in preloadNostr:', error);
      }
    };
    
    preloadNostr();
  }, []);
  
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  
  // On first render, clean up any old localStorage data that's no longer needed
  useEffect(() => {
    const cleanupOldStorage = () => {
      try {
        // Keys to remove
        const keysToRemove = [
          'teamsData',
          'teamMemberships',
          'teamMessages',
          'teamChallenges',
          'teamPinnedPosts',
          'groupsMigrationComplete'
        ];
        
        // Find and remove all pinned_messages_* keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('pinned_messages_')) {
            keysToRemove.push(key);
          }
        }
        
        // Remove each key
        keysToRemove.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`Removed old data: ${key}`);
          }
        });
      } catch (err) {
        console.error('Error cleaning up old localStorage:', err);
      }
    };
    
    cleanupOldStorage();
  }, []);
  
  if (hasError) {
    return <ErrorFallback />;
  }
  
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <SettingsProvider>
              <ActivityModeProvider>
                <RunTrackerProvider>
                  <GroupsProvider>
                    <WalletProvider>
                      <div className="relative w-full h-full bg-[#111827] text-white">
                        <MenuBar />
                        <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                          <Suspense fallback={<EnhancedLoadingFallback />}>
                            <AppRoutes />
                          </Suspense>
                        </main>
                      </div>
                    </WalletProvider>
                  </GroupsProvider>
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
