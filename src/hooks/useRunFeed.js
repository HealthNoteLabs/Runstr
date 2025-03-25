import { useState, useCallback, useEffect } from 'react';
import { fetchRunningPosts, loadSupplementaryData } from '../utils/nostr';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate timestamp for the current page (1 week per page)
      const since = Math.floor((Date.now() - (page * 7 * 24 * 60 * 60 * 1000)) / 1000);
      
      // Fetch posts from Nostr
      const fetchedPosts = await fetchRunningPosts(since);
      
      // Load supplementary data
      const postsWithData = await loadSupplementaryData(fetchedPosts);

      // Update posts state, avoiding duplicates
      setPosts(prevPosts => {
        const newPosts = [...prevPosts];
        postsWithData.forEach(post => {
          if (!newPosts.find(p => p.id === post.id)) {
            newPosts.push(post);
          }
        });
        return newPosts;
      });

      // Update hasMore based on whether we got any new posts
      setHasMore(fetchedPosts.length > 0);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching running posts:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Load more posts
  const loadMorePosts = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  // Initial load
  useEffect(() => {
    fetchRunPostsViaSubscription();
  }, [fetchRunPostsViaSubscription]);

  return {
    posts,
    loading,
    error,
    userLikes,
    userReposts,
    page,
    hasMore,
    loadMorePosts
  };
}; 