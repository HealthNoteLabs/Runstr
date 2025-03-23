import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  
  // Use the custom hooks optimized for Android
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

  // Implement a more robust retry mechanism
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    console.log(`Retry attempt ${retryCount + 1}`);
    fetchRunPostsViaSubscription();
  };

  // Android-specific scroll handler with throttling for performance
  useEffect(() => {
    let isThrottled = false;
    const throttleTime = 300; // ms
    
    const handleScroll = () => {
      if (isThrottled) return;
      
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, throttleTime);
      
      const scrollPosition = 
        window.scrollY || 
        document.documentElement.scrollTop ||
        document.body.scrollTop || 
        0;
      
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      
      const screenHeight = 
        window.innerHeight ||
        document.documentElement.clientHeight ||
        document.body.clientHeight || 
        0;
      
      // Load more when we're 400px from the bottom (more buffer for mobile)
      if (scrollPosition + screenHeight > height - 400) {
        console.log('Android scroll trigger - loading more posts');
        loadMorePosts();
      }
    };

    // Add passive listener for better scroll performance on Android
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  // Auto-retry with increasing delay if initial load fails
  useEffect(() => {
    if (error && retryCount < 3) {
      // Retry with exponential backoff
      const backoffTime = 2000 * Math.pow(2, retryCount);
      console.log(`Scheduling automatic retry #${retryCount + 1} in ${backoffTime}ms`);
      
      const retryTimeout = setTimeout(() => {
        console.log(`Auto-retry attempt #${retryCount + 1}`);
        fetchRunPostsViaSubscription();
        setRetryCount(prev => prev + 1);
      }, backoffTime);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [error, retryCount, fetchRunPostsViaSubscription]);

  return (
    <div className="run-club-container">
      <h2>RUNSTR FEED</h2>
      {loading && posts.length === 0 ? (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Loading posts...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <p className="retry-attempts">{retryCount > 0 ? `Retry attempts: ${retryCount}/3` : ''}</p>
          <button 
            className="retry-button" 
            onClick={handleRetry}
            disabled={retryCount >= 3}
          >
            {retryCount >= 3 ? 'Max retries reached' : 'Retry'}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="no-posts-message">
          <p>No running posts found</p>
          <button 
            className="retry-button" 
            onClick={handleRetry}
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