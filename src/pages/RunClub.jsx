import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { fetchEvents } from '../utils/nostr';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  
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

  // Simple diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Fetch a single event to test connectivity
      const testEvents = await fetchEvents({
        kinds: [1],
        limit: 1
      });
      
      if (testEvents && testEvents.length > 0) {
        setDiagnosticInfo(`Connection successful! Fetched ${testEvents.length} test event(s).`);
        console.log('Test events:', testEvents);
      } else {
        setDiagnosticInfo('Connection seems to work but no events returned. Try again or check console for details.');
      }
    } catch (error) {
      setDiagnosticInfo(`Connection error: ${error.message}`);
      console.error('Diagnostic error:', error);
    }
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
      <h2>RUNSTR FEED</h2>
      {loading && posts.length === 0 ? (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
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
          <p>No running posts found</p>
          <button 
            className="retry-button" 
            onClick={fetchRunPostsViaSubscription}
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