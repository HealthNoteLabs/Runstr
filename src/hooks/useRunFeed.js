import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeNostr, fetchEvents, subscribe } from '../utils/nostr';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const activeSubscription = useRef(null);
  const timeoutRef = useRef(null);
  const networkRetryCount = useRef(0);

  // Mobile-optimized processing of post data
  const processBasicPostData = useCallback(async (newPosts) => {
    try {
      if (!newPosts || newPosts.length === 0) {
        return [];
      }

      console.log('Processing basic post data for Android:', newPosts.length, 'posts');
      
      // Limit the number of posts processed on mobile
      const limitedPosts = newPosts.length > 40 ? newPosts.slice(0, 40) : newPosts;
      
      const authors = [...new Set(limitedPosts.map((post) => post.pubkey))];
      
      // Mobile optimization: fetch profiles in chunks to avoid timeouts
      const chunkSize = 10;
      const profileEventsSet = new Set();
      
      for (let i = 0; i < authors.length; i += chunkSize) {
        const chunk = authors.slice(i, i + chunkSize);
        const chunkEvents = await fetchEvents({
          kinds: [0],
          authors: chunk,
          limit: chunk.length
        });
        
        chunkEvents.forEach(event => profileEventsSet.add(event));
      }
      
      const profileEvents = Array.from(profileEventsSet);

      const profileMap = new Map(
        profileEvents.map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile on Android:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      return limitedPosts
        .map((post) => {
          const profile = profileMap.get(post.pubkey) || {};
          
          return {
            id: post.id,
            content: post.content,
            created_at: post.created_at,
            author: {
              pubkey: post.pubkey,
              profile: profile,
              lud16: profile.lud16,
              lud06: profile.lud06
            },
            comments: [],
            showComments: false,
            likes: 0,
            reposts: 0,
            zaps: 0,
            zapAmount: 0,
            hasFullData: false
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing basic post data on Android:', err);
      return newPosts.slice(0, 20).map(post => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        author: {
          pubkey: post.pubkey,
          profile: {}
        },
        comments: [],
        showComments: false,
        likes: 0,
        reposts: 0,
        zaps: 0,
        zapAmount: 0,
        hasFullData: false
      })).sort((a, b) => b.created_at - a.created_at);
    }
  }, []);

  // Load supplementary data with mobile optimization
  const loadSupplementaryData = useCallback(async (postId) => {
    if (loadedSupplementaryData.has(postId)) {
      return;
    }

    console.log('Loading supplementary data on Android for post:', postId);
    setLoadedSupplementaryData(prev => new Set([...prev, postId]));

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const post = posts[postIndex];
    
    try {
      // Get user's pubkey for like/repost detection
      let userPubkey = '';
      try {
        // Try to get from window.nostr first (browser extension)
        if (window.nostr) {
          userPubkey = await window.nostr.getPublicKey().catch(() => '');
        }
        
        // If that fails, use our internal implementation
        if (!userPubkey) {
          userPubkey = await import('../utils/nostr').then(module => module.getUserPublicKey());
        }
        
        console.log('Using public key for interactions:', userPubkey ? userPubkey.substring(0, 10) + '...' : 'none');
      } catch (keyError) {
        console.error('Error getting user pubkey:', keyError);
      }
      
      // Mobile optimization: Run these in series with shorter timeouts instead of in parallel
      // to reduce memory pressure and avoid network congestion
      const commentsSet = await fetchEvents({
        kinds: [1],
        '#e': [postId],
        limit: 20 // Limit comments for mobile
      });
      
      const likesSet = await fetchEvents({
        kinds: [7],
        '#e': [postId],
        limit: 50
      });
      
      const repostsSet = await fetchEvents({
        kinds: [6],
        '#e': [postId],
        limit: 30
      });
      
      const zapReceiptsSet = await fetchEvents({
        kinds: [9735],
        '#e': [postId],
        limit: 20
      });
      
      const comments = Array.from(commentsSet);
      const likes = Array.from(likesSet);
      const reposts = Array.from(repostsSet);
      const zapReceipts = Array.from(zapReceiptsSet);

      // For mobile: limit the number of author profiles we fetch to save bandwidth
      const commentAuthors = [...new Set(comments.map(c => c.pubkey))].slice(0, 20);
      
      const commentProfileEventsSet = commentAuthors.length > 0 ? await fetchEvents({
        kinds: [0],
        authors: commentAuthors,
        limit: commentAuthors.length
      }) : new Set();
      
      const commentProfileEvents = Array.from(commentProfileEventsSet);

      const profileMap = new Map(
        commentProfileEvents.map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile on Android:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      let likesCount = likes.length;
      let userLiked = false;
      likes.forEach(like => {
        if (like.pubkey === userPubkey) {
          userLiked = true;
        }
      });

      let repostsCount = reposts.length;
      let userReposted = false;
      reposts.forEach(repost => {
        if (repost.pubkey === userPubkey) {
          userReposted = true;
        }
      });

      let zapCount = 0;
      let zapAmount = 0;
      zapReceipts.forEach(zapReceipt => {
        try {
          zapCount++;
          
          const amountTag = zapReceipt.tags.find(tag => tag[0] === 'amount');
          if (amountTag && amountTag[1]) {
            zapAmount += parseInt(amountTag[1], 10) / 1000;
          }
        } catch (err) {
          console.error('Error processing zap receipt on Android:', err);
        }
      });

      // For mobile: limit the number of comments to avoid UI performance issues
      const processedComments = comments.slice(0, 15).map((comment) => {
        const profile = profileMap.get(comment.pubkey) || {};
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          author: {
            pubkey: comment.pubkey,
            profile: profile
          }
        };
      }).sort((a, b) => a.created_at - b.created_at);

      if (userLiked) {
        setUserLikes(prev => new Set([...prev, postId]));
      }
      
      if (userReposted) {
        setUserReposts(prev => new Set([...prev, postId]));
      }

      const updatedPost = {
        ...post,
        comments: processedComments,
        likes: likesCount,
        reposts: repostsCount,
        zaps: zapCount,
        zapAmount: zapAmount,
        hasFullData: true
      };

      setPosts(currentPosts => {
        const newPosts = [...currentPosts];
        newPosts[postIndex] = updatedPost;
        return newPosts;
      });
    } catch (error) {
      console.error('Error loading supplementary data on Android:', error);
      // Don't set error state for supplementary data - just continue
    }
  }, [posts, loadedSupplementaryData]);

  // Fetch posts with Android-specific optimizations
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      console.log('Starting RunClub feed subscription on Android');
      setLoading(true);
      setError(null);
      
      // Clean up any existing subscription
      if (activeSubscription.current) {
        console.log('Cleaning up previous subscription on Android');
        activeSubscription.current.stop();
        activeSubscription.current = null;
      }
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr connection with retry for mobile networks
      let connected = await initializeNostr();
      console.log('Initial connection attempt result:', connected);
      
      // Mobile optimization: retry connection with exponential backoff
      if (!connected && networkRetryCount.current < 3) {
        console.log(`Android network retry ${networkRetryCount.current + 1}/3...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, networkRetryCount.current)));
        connected = await initializeNostr();
        console.log('Retry connection result:', connected);
        networkRetryCount.current++;
      } else {
        networkRetryCount.current = 0;
      }
      
      if (!connected) {
        throw new Error('Failed to connect to Nostr network. Please check your connection and try again.');
      }

      // Mobile optimization: shorter time window for older pages to reduce data usage
      const timeWindow = page > 1 ? (page * 3 * 24 * 60 * 60) : (30 * 24 * 60 * 60); // 30 days instead of 14
      const since = Math.floor(Date.now() / 1000) - timeWindow;
      
      console.log('Creating subscription for running posts since', new Date(since * 1000).toISOString());
      
      // Create a subscription
      const runEventsCollector = new Set();
      
      const subscription = subscribe({
        kinds: [1],
        since,
        "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog", "jogging", "fitness", "workout", "training", "strava", "race", "halfmarathon", "ultramarathon", "trail", "trailrunning"],
        limit: 50 // Increased limit
      });
      
      activeSubscription.current = subscription;
      
      subscription.on('event', (event) => {
        console.log('Received run post event on Android:', event.id);
        runEventsCollector.add(event);
      });
      
      subscription.on('eose', async () => {
        console.log(`End of stored events received on Android, got ${runEventsCollector.size} running posts`);
        
        if (runEventsCollector.size === 0 && page === 1) {
          console.log('No running posts found on Android, trying broader search');
          // If no posts found on first page, try with just basic kinds query
          const broadSubscription = subscribe({
            kinds: [1],
            since,
            limit: 50 // Increased limit for broader search
          });
          
          const broadEvents = new Set();
          
          broadSubscription.on('event', (event) => {
            // Filter events that might be running-related but don't have the tags
            const content = event.content.toLowerCase();
            const runningTerms = ['run', 'running', 'marathon', 'jog', '5k', '10k', 'km', 'miles', 'strava', 'race', 'training', 'workout'];
            
            // Check content for running terms
            if (runningTerms.some(term => content.includes(term))) {
              console.log('Found potential running post from broader search on Android:', event.id);
              broadEvents.add(event);
            }
            
            // Check for running-related hashtags in content
            const hashtagRegex = /#(\w+)/g;
            const matches = content.match(hashtagRegex) || [];
            const hashtags = matches.map(match => match.substring(1).toLowerCase());
            
            if (hashtags.some(tag => runningTerms.includes(tag))) {
              console.log('Found potential running post with hashtag on Android:', event.id);
              broadEvents.add(event);
            }
          });
          
          broadSubscription.on('eose', async () => {
            console.log(`Broad search complete on Android, found ${broadEvents.size} potential running posts`);
            
            if (broadEvents.size > 0) {
              const postsArray = Array.from(broadEvents);
              const processedPosts = await processBasicPostData(postsArray);
              setPosts(processedPosts);
            }
            
            setLoading(false);
            setInitialLoadComplete(true);
          });
          
          // Mobile optimization: shorter timeout to preserve battery
          setTimeout(() => {
            if (broadSubscription) {
              console.log('Closing broad search subscription after timeout on Android');
              broadSubscription.stop();
            }
          }, 15000); // 15 seconds instead of 8
          
          return;
        }
        
        const postsArray = Array.from(runEventsCollector).sort((a, b) => b.created_at - a.created_at);
        
        if (postsArray.length < 20) { // Lower threshold for mobile
          setHasMore(false);
        }
        
        const processedPosts = await processBasicPostData(postsArray);
        
        if (page === 1) {
          setPosts(processedPosts);
        } else {
          setPosts(prevPosts => {
            // Filter out duplicates by ID
            const existingIds = new Set(prevPosts.map(p => p.id));
            const newUniqueEvents = processedPosts.filter(p => !existingIds.has(p.id));
            return [...prevPosts, ...newUniqueEvents];
          });
        }
        
        setLoading(false);
        setInitialLoadComplete(true);
      });
      
      // Mobile optimization: shorter timeout to preserve battery
      timeoutRef.current = setTimeout(() => {
        if (loading) {
          console.log('Subscription timeout reached on Android');
          
          if (runEventsCollector.size > 0) {
            // If we have events but EOSE never fired, still process what we have
            console.log(`Processing ${runEventsCollector.size} events from timed out subscription on Android`);
            processBasicPostData(Array.from(runEventsCollector)).then(processedPosts => {
              if (page === 1) {
                setPosts(processedPosts);
              } else {
                setPosts(prevPosts => {
                  // Filter out duplicates by ID
                  const existingIds = new Set(prevPosts.map(p => p.id));
                  const newUniqueEvents = processedPosts.filter(p => !existingIds.has(p.id));
                  return [...prevPosts, ...newUniqueEvents];
                });
              }
              setInitialLoadComplete(true);
              setLoading(false);
            });
          } else {
            // No events received, try the broader search as a fallback
            console.log('No events received by timeout, trying broader search as fallback');
            
            const broadSubscription = subscribe({
              kinds: [1],
              since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
              limit: 100 // Increased limit for broader search
            });
            
            const broadEvents = new Set();
            
            broadSubscription.on('event', (event) => {
              // Filter events that might be running-related but don't have the tags
              const content = event.content.toLowerCase();
              const runningTerms = ['run', 'running', 'marathon', 'jog', '5k', '10k', 'km', 'miles', 'strava', 'race', 'training', 'workout'];
              
              // Check content for running terms
              if (runningTerms.some(term => content.includes(term))) {
                broadEvents.add(event);
              }
            });
            
            broadSubscription.on('eose', async () => {
              console.log(`Broad search complete as fallback, found ${broadEvents.size} potential running posts`);
              
              if (broadEvents.size > 0) {
                const postsArray = Array.from(broadEvents);
                const processedPosts = await processBasicPostData(postsArray);
                setPosts(processedPosts);
                setLoading(false);
                setInitialLoadComplete(true);
              } else {
                setError('No running posts found. Please try again later.');
                setLoading(false);
              }
              
              broadSubscription.stop();
            });
            
            // Set a shorter timeout for the fallback search
            setTimeout(() => {
              if (broadSubscription) {
                broadSubscription.stop();
                if (!initialLoadComplete) {
                  setError('Timed out waiting for posts. Please check your connection and try again.');
                  setLoading(false);
                }
              }
            }, 15000);
          }
        }
      }, 30000); // Increased from 25 seconds to 30 seconds
      
    } catch (err) {
      console.error('Error in subscription on Android:', err.message, err.stack);
      setError(`Failed to load posts: ${err.message}. Please check your connection and try again.`);
      setLoading(false);
    }
  }, [page, processBasicPostData]);

  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Initialize and handle scroll for Android
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted && (page === 1 || !initialLoadComplete)) {
        fetchRunPostsViaSubscription();
      }
    };
    
    init();

    return () => {
      mounted = false;
      // Clean up subscription on unmount
      if (activeSubscription.current) {
        console.log('Cleaning up subscription on Android unmount');
        activeSubscription.current.stop();
      }
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchRunPostsViaSubscription, page, initialLoadComplete]);
  
  // Return the hook data and functions
  return {
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
    hasMore,
    setPage,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData
  };
}; 