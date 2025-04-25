import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { handleAppBackground } from '../utils/nostr';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use the custom hooks
  const {
    posts,
    setPosts,
    loading,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts,
    setPosts,
    setUserLikes,
    setUserReposts,
    loadSupplementaryData,
    loadedSupplementaryData,
    defaultZapAmount
  });

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
          fetchRunPostsViaSubscription();
        } else {
          // Connected but no running posts
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found. Trying broader search...');
          
          // Try the content-based search as a fallback
          const { searchRunningContent } = await import('../utils/nostr');
          const contentResults = await searchRunningContent(50, 72); // Search last 72 hours
          
          if (contentResults.length > 0) {
            setDiagnosticInfo(`Success! Found ${contentResults.length} posts mentioning running in their content. Refreshing feed...`);
            // You'll need to process these events similarly to how fetchRunPostsViaSubscription does
            // For now, just refresh the feed
            fetchRunPostsViaSubscription();
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

  // Function to refresh the feed when the header is clicked
  const refreshFeed = () => {
    // Don't allow multiple refreshes at once
    if (loading || isRefreshing) return;
    
    setIsRefreshing(true);
    fetchRunPostsViaSubscription()
      .finally(() => {
        // Reset the refreshing state after a delay to show animation
        setTimeout(() => {
          setIsRefreshing(false);
        }, 500);
      });
  };

  // Simple scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const screenHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Load more when we're close to the bottom
      if (scrollPosition + screenHeight > height - 300) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  return (
    <div className="run-club-container">
      <button 
        className={`feed-header-button ${isRefreshing ? 'refreshing' : ''}`}
        onClick={refreshFeed}
        disabled={loading || isRefreshing}
      >
        <h2>RUNSTR FEED</h2>
        {isRefreshing && <span className="refresh-icon">↻</span>}
      </button>
      
      {loading && posts.length === 0 ? (
        <div className="loading-indicator">
          <p>Loading posts...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <div className="error-buttons">
            <button 
              className="retry-button" 
              onClick={refreshFeed}
            >
              Retry
            </button>
            <button 
              className="diagnose-button" 
              onClick={diagnoseConnection}
            >
              Diagnose Connection
            </button>
          </div>
          {diagnosticInfo && (
            <div className="diagnostic-info">
              <p>{diagnosticInfo}</p>
            </div>
          )}
        </div>
      ) : posts.length === 0 ? (
        <div className="no-posts-message">
          <p>No running posts found</p>
          <button 
            className="retry-button" 
            onClick={refreshFeed}
          >
            Refresh
          </button>
        </div>
      ) : (
        <PostList
          posts={posts}
          loading={loading}
          page={1}
          userLikes={userLikes}
          userReposts={userReposts}
          handleLike={handleLike}
          handleRepost={handleRepost}
          handleZap={(post) => handleZap(post, wallet)}
          handleCommentClick={handleCommentClick}
          handleComment={handleComment}
          commentText={commentText}
          setCommentText={setCommentText}
          wallet={wallet}
        />
      )}
    </div>
  );
};