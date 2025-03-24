import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';
import dvmService from '../services/DVMService';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [useDVM, setUseDVM] = useState(true); // Flag to control whether to use DVM or direct Nostr
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Function to fetch run posts via DVM
  const fetchRunPostsViaDVM = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Calculate since timestamp for pagination
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      const since = page > 1 
        ? Math.floor(Date.now() / 1000) - (page * sevenDaysInSeconds) 
        : Math.floor(Date.now() / 1000) - sevenDaysInSeconds;
      
      const limit = 10; // Load 10 posts per page

      // Use DVM service to fetch running feed
      const runFeedData = await dvmService.getRunningFeed({
        limit,
        since,
        include_workouts: true
      });
      
      console.log(`DVM: Fetched ${runFeedData.feed.length} running posts`);
      
      // If we didn't get enough posts, there may not be more to load
      if (runFeedData.feed.length < limit) {
        setHasMore(false);
      }
      
      // Skip processing if we didn't get any posts
      if (runFeedData.feed.length === 0) {
        if (page === 1) {
          setPosts([]);
          setError('No running posts found. Try again later or switch to direct Nostr.');
        }
        setLoading(false);
        return;
      }
      
      // Process DVM feed posts into the format expected by the UI
      const processedPosts = runFeedData.feed.map(note => {
        return {
          id: note.id,
          pubkey: note.author.pubkey,
          content: note.content,
          created_at: note.created_at,
          tags: note.tags || [],
          author: {
            name: note.author.name || 'Unknown',
            displayName: note.author.display_name || note.author.name || 'Unknown',
            picture: note.author.picture || undefined,
            nip05: note.author.nip05 || undefined
          },
          hashtags: note.hashtags || [],
          mentions: note.mentions || [],
          zapCount: note.zap_count || 0,
          zapAmount: note.zap_amount || 0,
          likeCount: note.like_count || 0,
          repostCount: note.repost_count || 0,
          replies: note.replies || [],
          runData: note.run_data || undefined,
          workout: note.workout
        };
      });
      
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
      
      // Initialize userLikes and userReposts
      // Note: We'll need to enhance the DVM API to get this information or refactor to maintain local likes/reposts
      initialLoadRef.current = true;
    } catch (err) {
      console.error('Error fetching running posts from DVM:', err);
      setError(`Failed to load posts from DVM: ${err.message}. Falling back to direct Nostr.`);
      
      // If DVM fails, fall back to direct Nostr
      setUseDVM(false);
      fetchRunPostsViaSubscription();
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Main function to fetch run posts directly from Nostr - original implementation
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
      const limit = 10; // Load 10 posts per page just like the working implementation

      // Fetch posts with running hashtags - EXACT same approach as working version
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

  // Toggle between DVM and direct Nostr
  const toggleDataSource = useCallback(() => {
    setUseDVM(prev => !prev);
    // Reset state for new data source
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    initialLoadRef.current = false;
  }, []);

  // Load more posts when user scrolls to bottom
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
      if (useDVM) {
        // With DVM, we would fetch additional data about this specific post
        // This would need to be implemented in the DVM API
        console.log('Requesting additional data for post via DVM:', postId);
        // For now, we don't have a specific endpoint for this
      } else {
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
      }
    } catch (error) {
      console.error('Error loading supplementary data:', error);
    }
  }, [posts, loadedSupplementaryData, useDVM]);

  // Fetch posts based on selected data source
  const fetchPosts = useCallback(() => {
    if (useDVM) {
      fetchRunPostsViaDVM();
    } else {
      fetchRunPostsViaSubscription();
    }
  }, [useDVM, fetchRunPostsViaDVM, fetchRunPostsViaSubscription]);

  // Initial load effect
  useEffect(() => {
    // Only fetch if this is the first page or we've already done the initial load
    if (page === 1 || initialLoadRef.current) {
      fetchPosts();
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchPosts, page]);

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
    fetchRunPostsViaSubscription: fetchPosts, // Renamed for backwards compatibility
    loadedSupplementaryData,
    hasMore,
    useDVM,
    toggleDataSource
  };
}; 