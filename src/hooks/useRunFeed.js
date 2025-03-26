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

  // Main function to fetch run posts - closely matches working implementation
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      const connected = await initializeNostr();
      if (!connected) {
        throw new Error('Could not connect to Nostr relays');
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 100; // Increased limit to match working implementation

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

  // Load more posts when user scrolls to bottom - like working implementation
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Load supplementary data for a single post (for comments, etc)
  const loadPostSupplementaryData = useCallback(async (postId) => {
    if (loadedSupplementaryData.has(postId)) {
      return;
    }

    setLoadedSupplementaryData(prev => new Set([...prev, postId]));
    
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    try {
      // Find the post that needs supplementary data
      const post = posts[postIndex];
      
      // Use our parallel loading function to get all data for this post
      const supplementData = await loadSupplementaryData([post]);
      
      // Process this single post with the data
      const processedPosts = await processPostsWithData([post], supplementData);
      
      if (processedPosts.length > 0) {
        // Update just this post in the state
        setPosts(currentPosts => {
          const newPosts = [...currentPosts];
          newPosts[postIndex] = processedPosts[0];
          return newPosts;
        });
      }
    } catch (error) {
      console.error('Error loading supplementary data:', error);
    }
  }, [posts, loadedSupplementaryData]);

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
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData: loadPostSupplementaryData,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    hasMore
  };
}; 