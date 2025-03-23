import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initNostr, 
  fetchRunningPosts, 
  processPostsWithProfiles
} from '../utils/nostr-simplified';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Main function to fetch run posts - simplified version
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      await initNostr();

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 20; // Increased limit for better results

      // Fetch posts with running hashtags
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      
      // If we didn't get enough posts, there may not be more to load
      if (runPostsArray.length < limit) {
        setHasMore(false);
      }
      
      // Skip processing if we didn't get any posts
      if (runPostsArray.length === 0) {
        if (page === 1) {
          setPosts([]);
          setError('No running posts found. Try again later.');
        }
        setLoading(false);
        return;
      }
      
      // Process posts with profile information
      const processedPosts = await processPostsWithProfiles(runPostsArray);
      
      // Update state with processed posts
      if (page === 1) {
        setPosts(processedPosts);
      } else {
        // For pagination, append new posts, removing duplicates
        setPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          return [...prevPosts, ...newPosts];
        });
      }
      
      initialLoadRef.current = true;
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Load more posts when user scrolls to bottom
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Initial load effect
  useEffect(() => {
    // Only fetch if this is the first page or we've already done the initial load
    if (page === 1 || initialLoadRef.current) {
      fetchRunPostsViaSubscription();
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchRunPostsViaSubscription, page]);

  return {
    posts,
    setPosts,
    loading,
    error,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    hasMore
  };
}; 