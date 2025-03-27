import { useState, useEffect } from 'react';

export const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // This is a simplified version since we don't have access to the full
    // subscription functionality
    setTimeout(() => {
      setPosts([
        {
          id: '1',
          content: 'Just finished a 5K run! Great weather today.',
          created_at: Date.now() / 1000 - 3600
        },
        {
          id: '2',
          content: 'New personal best on my 10K run. Feeling accomplished!',
          created_at: Date.now() / 1000 - 7200
        }
      ]);
      setLoading(false);
    }, 1000);
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div className="feed-page">
      <h1>Activity Feed</h1>
      
      {loading ? (
        <div className="loading">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          No posts found. Be the first to share your run!
        </div>
      ) : (
        <div className="post-list">
          {posts.map(post => (
            <div key={post.id} className="post-item">
              <div className="post-content">{post.content}</div>
              <div className="post-timestamp">
                {new Date(post.created_at * 1000).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 