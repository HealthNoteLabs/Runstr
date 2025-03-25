import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      await initializeNostr();

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 10; // Load 10 posts per page

      // Fetch posts with running hashtags
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      
      // If we got no results with tags, try a content search as fallback
      if (runPostsArray.length === 0 && page === 1) {
        console.log('No tagged running posts found, trying content search');
        const contentPosts = await searchRunningContent(limit, 72); // 72 hours
        
        if (contentPosts.length > 0) {
          console.log(`Found ${contentPosts.length} posts through content search`);
          
          // Load supplementary data in parallel for all posts
          const supplementaryData = await loadSupplementaryData(contentPosts);
          
          // Process posts with all the data
          const processedPosts = await processPostsWithData(contentPosts, supplementaryData);
          
          // Update state with processed posts
          setPosts(processedPosts);
          
          // Capture which posts the user has liked/reposted
          const newUserLikes = new Set();
          const newUserReposts = new Set();
          
          supplementaryData.likes?.forEach(like => {
            try {
              if (window.nostr && like.pubkey === window.nostr.getPublicKey()) {
                const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
                if (postId) newUserLikes.add(postId);
              }
            } catch (err) {
              console.error('Error processing user likes:', err);
            }
          });
          
          supplementaryData.reposts?.forEach(repost => {
            try {
              if (window.nostr && repost.pubkey === window.nostr.getPublicKey()) {
                const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
                if (postId) newUserReposts.add(postId);
              }
            } catch (err) {
              console.error('Error processing user reposts:', err);
            }
          });
          
          setUserLikes(newUserLikes);
          setUserReposts(newUserReposts);
          
          setHasMore(contentPosts.length >= limit);
          setLoading(false);
          initialLoadRef.current = true;
          return;
        }
      }
      
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
      
      // Load supplementary data in parallel for all posts
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      
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
      
      // Capture which posts the user has liked/reposted
      const newUserLikes = new Set();
      const newUserReposts = new Set();
      
      supplementaryData.likes?.forEach(like => {
        try {
          if (window.nostr && like.pubkey === window.nostr.getPublicKey()) {
            const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
            if (postId) newUserLikes.add(postId);
          }
        } catch (err) {
          console.error('Error processing user likes:', err);
        }
      });
      
      supplementaryData.reposts?.forEach(repost => {
        try {
          if (window.nostr && repost.pubkey === window.nostr.getPublicKey()) {
            const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
            if (postId) newUserReposts.add(postId);
          }
        } catch (err) {
          console.error('Error processing user reposts:', err);
        }
      });
      
      setUserLikes(newUserLikes);
      setUserReposts(newUserReposts);
      
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

  // Initial load and refresh on page change
  useEffect(() => {
    fetchRunPostsViaSubscription();
  }, [fetchRunPostsViaSubscription]);

  // Refresh feed periodically
  useEffect(() => {
    if (initialLoadRef.current) {
      const refreshInterval = setInterval(() => {
        setPage(1); // Reset to first page
        fetchRunPostsViaSubscription();
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [fetchRunPostsViaSubscription]);

  return {
    posts,
    loading,
    error,
    userLikes,
    userReposts,
    loadMorePosts,
    refresh: () => {
      setPage(1);
      fetchRunPostsViaSubscription();
    }
  };
}; 