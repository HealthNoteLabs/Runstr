import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from './PostList';
import { handleAppBackground } from '../utils/nostr';
import './RunClub.css';

const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  
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
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
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
      // Import the diagnose function
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
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found.');
        }
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
    }
  };

  // Toggle debug overlay visibility
  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };
  
  return (
    <div className="run-club-container">
      <h2>RUNSTR FEED</h2>
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
              onClick={fetchRunPostsViaSubscription}
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
          <p>No running posts found. Follow some runners or post your own run!</p>
          <button 
            className="retry-button" 
            onClick={fetchRunPostsViaSubscription}
          >
            Refresh
          </button>
          <button 
            className="diagnose-button" 
            onClick={diagnoseConnection}
          >
            Diagnose Connection
          </button>
        </div>
      ) : (
        <>
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
          
          {/* Load More Button */}
          {canLoadMore() && (
            <div className="load-more-container">
              <button 
                className="load-more-button" 
                onClick={loadMorePosts}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Debug toggle button */}
      <button 
        onClick={toggleDebug}
        className="debug-toggle"
        style={{
          bottom: showDebug ? '200px' : '10px'
        }}
      >
        {showDebug ? 'X' : '🐞'}
      </button>
      
      {/* Debug overlay - remove after debugging */}
      {showDebug && (
        <div className="debug-overlay">
          <h3>Debug Info</h3>
          <p>Connected relays: {window.NDK?.pool?.relays?.size || 0}</p>
          <p>Posts loaded: {posts?.length || 0}</p>
          <p>Feed error: {error || 'None'}</p>
          <p>Loading state: {loading ? 'Loading' : 'Idle'}</p>
          <p>User interactions: {userLikes?.size || 0} likes, {userReposts?.size || 0} reposts</p>
          <div className="debug-actions">
            <button 
              onClick={fetchRunPostsViaSubscription}
              className="debug-button"
            >
              Refresh Feed
            </button>
            <button 
              onClick={diagnoseConnection}
              className="debug-button secondary"
            >
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunClub; 