import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import PostList from '../components/PostList';
import { handleAppBackground } from '../utils/nostr';

const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  // Use the custom hooks
  const {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    refreshPosts,
    userLikes,
    userReposts,
    handleLike,
    handleRepost,
    handleComment
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleCommentClick,
    handleZap,
    loadedSupplementaryData
  } = usePostInteractions({
    posts,
    userLikes,
    userReposts,
    defaultZapAmount,
    loadedSupplementaryData
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle app lifecycle events for Android
  useEffect(() => {
    // This code would use AppState in a real React Native app
    // For example: AppState.addEventListener('change', (nextAppState) => {
    //   // Handle app state changes: background, foreground, etc.
    // });
    
    // Cleanup function for when component unmounts
    return () => {
      // Close any active connections when component unmounts
      handleAppBackground();
    };
  }, []);

  // Simple diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Import the diagnose function from our simplified nostr.js
      const { diagnoseConnection } = await import('../utils/nostr');
      
      // Run the comprehensive diagnostic
      const results = await diagnoseConnection();
      
      if (results.error) {
        setDiagnosticInfo(`Connection error: ${results.error}`);
        return;
      }
      
      if (results.generalEvents > 0) {
        // We can at least connect and fetch some posts
        setDiagnosticInfo(`Connection successful! Fetched ${results.generalEvents} general posts.`);
        
        if (results.runningEvents > 0) {
          // We found running-specific posts too
          setDiagnosticInfo(`Success! Found ${results.runningEvents} running-related posts. Refreshing feed...`);
          refreshPosts();
        } else {
          // Connected but no running posts
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found. Trying broader search...');
          
          // Try the content-based search as a fallback
          const { searchRunningContent } = await import('../utils/nostr');
          const contentResults = await searchRunningContent(50, 72); // Search last 72 hours
          
          if (contentResults.length > 0) {
            setDiagnosticInfo(`Success! Found ${contentResults.length} posts mentioning running in their content. Refreshing feed...`);
            // You'll need to process these events similarly to how refreshPosts does
            // For now, just refresh the feed
            refreshPosts();
          } else {
            setDiagnosticInfo('No running-related posts found by tag or content. There may not be any recent running posts on the network.');
          }
        }
      } else {
        // We connected but got no events
        const relayStatus = Object.entries(results.relayStatus)
          .map(([relay, status]) => `${relay}: ${status}`)
          .join(', ');
        
        setDiagnosticInfo(`Connected to relays but couldn't fetch any events. Relay status: ${relayStatus}`);
      }
    } catch (error) {
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
      console.error('Error running diagnostic:', error);
    }
  };

  // Handle retry with backoff
  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      setDiagnosticInfo('Maximum retry attempts reached. Please check your connection and try again later.');
      return;
    }

    setRetryCount(prev => prev + 1);
    setDiagnosticInfo(`Retrying connection (attempt ${retryCount + 1}/${maxRetries})...`);
    
    try {
      await refreshPosts();
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error('Retry error:', err);
      setDiagnosticInfo(`Retry failed: ${err.message}`);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPosts();
    setIsRefreshing(false);
  };

  return (
    <div className="run-club-container">
      <h2>Run Club Feed</h2>
      
      {loading && !posts.length && (
        <div className="loading-indicator">
          Connecting to relays...
        </div>
      )}

      {error && !posts.length && (
        <div className="error-message">
          <p>{error}</p>
          <div className="error-buttons">
            <button 
              className="retry-button"
              onClick={handleRetry}
              disabled={retryCount >= 3}
            >
              {retryCount >= 3 ? 'Max retries reached' : 'Retry'}
            </button>
            <button 
              className="diagnose-button"
              onClick={diagnoseConnection}
            >
              Diagnose
            </button>
          </div>
          {diagnosticInfo && (
            <div className="diagnostic-info">
              <pre>{JSON.stringify(diagnosticInfo, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="no-posts-message">
          No running posts found. Pull down to refresh.
        </div>
      )}

      {posts.length > 0 && (
        <PostList
          posts={posts}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          userLikes={userLikes}
          userReposts={userReposts}
          onLike={handleLike}
          onRepost={handleRepost}
          onComment={handleComment}
          commentText={commentText}
          setCommentText={setCommentText}
          handleCommentClick={handleCommentClick}
          handleZap={(post) => handleZap(post, wallet)}
          wallet={wallet}
        />
      )}
    </div>
  );
};

export default RunClub;