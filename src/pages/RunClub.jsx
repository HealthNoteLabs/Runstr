import { useEffect, useState } from 'react';
import { useRunFeed } from '../hooks/useRunFeed';
import { cleanup } from '../utils/nostr-simplified';

export const RunClub = () => {
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  
  // Use the simplified hook
  const {
    posts,
    loading,
    error,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    hasMore
  } = useRunFeed();

  // Handle app lifecycle events
  useEffect(() => {
    // Cleanup function for when component unmounts
    return () => {
      // Close any active connections when component unmounts
      cleanup();
    };
  }, []);

  // Simple diagnostic function
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Attempt to fetch posts as a diagnostic
      await fetchRunPostsViaSubscription();
      setDiagnosticInfo('Connection successful! Feed refreshed.');
    } catch (error) {
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
      console.error('Error running diagnostic:', error);
    }
  };

  // Simple scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const screenHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Load more when we're close to the bottom
      if (scrollPosition + screenHeight > height - 300 && hasMore) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts, hasMore]);

  // Simplified post rendering function
  const renderPosts = () => {
    return posts.map(post => (
      <div key={post.id} className="post">
        <div className="post-header">
          <div className="post-avatar">
            {post.author.profile.picture ? (
              <img 
                src={post.author.profile.picture} 
                alt={post.author.profile.name || 'Anonymous'} 
              />
            ) : (
              <div className="default-avatar"></div>
            )}
          </div>
          <div className="post-author">
            <h3>{post.author.profile.name || 'Anonymous'}</h3>
            <p>{post.author.profile.nip05 || '@' + post.author.pubkey.slice(0, 8)}</p>
          </div>
        </div>
        <div className="post-content">
          {post.content}
        </div>
        <div className="post-timestamp">
          {new Date(post.created_at * 1000).toLocaleString()}
        </div>
      </div>
    ));
  };

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
        <div className="posts-container">
          {renderPosts()}
          {loading && posts.length > 0 && (
            <div className="loading-more">
              <div className="loading-spinner"></div>
              <p>Loading more posts...</p>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div className="no-more-posts">
              <p>No more posts to load</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};