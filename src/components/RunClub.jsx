import { useEffect, useContext, useState, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from './PostList';
import { PullToRefresh } from './PullToRefresh';
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
    refreshing,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    refreshFeed,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    commentImages,
    handleAddCommentImage,
    handleRemoveCommentImage,
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
    setDiagnosticInfo('Running diagnostic...');
    try {
      // Check if we have window.nostr (NIP-07 extension) available
      const hasNip07 = !!window.nostr;
      
      // Check navigator.onLine
      const isOnline = navigator.onLine;
      
      // Try to connect to relays directly
      const { testRelayConnections } = await import('../utils/nostr');
      const results = await testRelayConnections();
      
      if (results.connectedCount > 0) {
        setDiagnosticInfo(
          `Connected to ${results.connectedCount}/${results.totalCount} relays. ` +
          `NIP-07: ${hasNip07 ? 'Available' : 'Not available'}. ` +
          `Online: ${isOnline ? 'Yes' : 'No'}`
        );
      } else {
        // We connected but got no events
        const relayStatus = Object.entries(results.relayStatus)
          .map(([relay, status]) => `${relay}: ${status}`)
          .join(', ');
        
        setDiagnosticInfo(`Connected to relays but couldn't fetch any events. Relay status: ${relayStatus}`);
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
  
  // Scroll to bottom detection for infinite scrolling
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // If we're close to the bottom of the scroll container and can load more
    if (scrollHeight - scrollTop - clientHeight < 200 && canLoadMore() && !loading && !refreshing) {
      loadMorePosts();
    }
  }, [canLoadMore, loadMorePosts, loading, refreshing]);
  
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
          <PullToRefresh 
            onRefresh={refreshFeed}
            isRefreshing={refreshing}
          >
            <div className="scrollable-feed-container" onScroll={handleScroll}>
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
                commentImages={commentImages}
                handleAddCommentImage={handleAddCommentImage}
                handleRemoveCommentImage={handleRemoveCommentImage}
              />
              
              {/* Loading indicator for infinite scroll */}
              {loading && posts.length > 0 && (
                <div className="infinite-scroll-loader">
                  <div className="loading-spinner"></div>
                  <span>Loading more posts...</span>
                </div>
              )}
            </div>
          </PullToRefresh>
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
          <p>Refreshing state: {refreshing ? 'Refreshing' : 'Idle'}</p>
          <p>User interactions: {userLikes?.size || 0} likes, {userReposts?.size || 0} reposts</p>
          <div className="debug-actions">
            <button 
              onClick={refreshFeed}
              className="debug-button"
            >
              Pull to Refresh
            </button>
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