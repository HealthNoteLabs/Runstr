import { useState, useEffect, useCallback, useContext } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk, initializeNostr } from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';

export const RunClub = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const { defaultZapAmount } = useContext(NostrContext);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const { wallet } = useAuth();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());

  const processBasicPostData = useCallback(async (newPosts) => {
    try {
      if (!newPosts || newPosts.length === 0) {
        return [];
      }

      console.log('Processing basic post data for', newPosts.length, 'posts');
      const authors = [...new Set(newPosts.map((post) => post.pubkey))];
      
      const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors
      });

      const profileMap = new Map(
        Array.from(profileEvents).map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      return newPosts
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
      console.error('Error processing basic post data:', err);
      return newPosts.map(post => ({
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

  const loadSupplementaryData = useCallback(async (postId) => {
    if (loadedSupplementaryData.has(postId)) {
      return;
    }

    console.log('Loading supplementary data for post:', postId);
    setLoadedSupplementaryData(prev => new Set([...prev, postId]));

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const post = posts[postIndex];
    
    const [comments, likes, reposts, zapReceipts] = await Promise.all([
      ndk.fetchEvents({
        kinds: [1],
        '#e': [postId]
      }),
      ndk.fetchEvents({
        kinds: [7],
        '#e': [postId]
      }),
      ndk.fetchEvents({
        kinds: [6],
        '#e': [postId]
      }),
      ndk.fetchEvents({
        kinds: [9735],
        '#e': [postId]
      })
    ]);

    const commentAuthors = [...new Set(Array.from(comments).map(c => c.pubkey))];
    
    const commentProfileEvents = commentAuthors.length > 0 ? await ndk.fetchEvents({
      kinds: [0],
      authors: commentAuthors
    }) : new Set();

    const profileMap = new Map(
      Array.from(commentProfileEvents).map((profile) => {
        try {
          return [profile.pubkey, JSON.parse(profile.content)];
        } catch (err) {
          console.error('Error parsing profile:', err);
          return [profile.pubkey, {}];
        }
      })
    );

    let userPubkey = '';
    try {
      if (window.nostr) {
        userPubkey = await window.nostr.getPublicKey();
      }
    } catch (err) {
      console.error('Error getting user pubkey:', err);
    }

    let likesCount = 0;
    let userLiked = false;
    Array.from(likes).forEach(like => {
      likesCount++;
      if (like.pubkey === userPubkey) {
        userLiked = true;
      }
    });

    let repostsCount = 0;
    let userReposted = false;
    Array.from(reposts).forEach(repost => {
      repostsCount++;
      if (repost.pubkey === userPubkey) {
        userReposted = true;
      }
    });

    let zapCount = 0;
    let zapAmount = 0;
    Array.from(zapReceipts).forEach(zapReceipt => {
      try {
        zapCount++;
        
        const amountTag = zapReceipt.tags.find(tag => tag[0] === 'amount');
        if (amountTag && amountTag[1]) {
          zapAmount += parseInt(amountTag[1], 10) / 1000;
        }
      } catch (err) {
        console.error('Error processing zap receipt:', err);
      }
    });

    const processedComments = Array.from(comments).map((comment) => {
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

  }, [posts, loadedSupplementaryData]);

  const processAndUpdatePosts = useCallback(async (newPosts, append = false) => {
    if (!newPosts || newPosts.length === 0) {
      if (!append) {
        setPosts([]);
      }
      return [];
    }
    
    const processedPosts = await processBasicPostData(newPosts);
    
    return processedPosts;
  }, [processBasicPostData]);

  const fetchRunPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await initializeNostr();

      const limit = 10;
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
  
      const runPosts = await ndk.fetchEvents({
        kinds: [1],
        limit,
        since,
        "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"]
      });

      const postsArray = Array.from(runPosts).sort((a, b) => b.created_at - a.created_at);
      
      if (postsArray.length < limit) {
        setHasMore(false);
      }
      
      const processedPosts = await processAndUpdatePosts(postsArray, page > 1);
      
      if (page === 1) {
        setPosts(processedPosts);
      } else {
        setPosts(prevPosts => [...prevPosts, ...processedPosts]);
      }
      
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error fetching run posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [page, processAndUpdatePosts]);

  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if ((page === 1 || initialLoadComplete) && mounted) {
        await fetchRunPosts();
      }
    };
    
    init();

    return () => {
      mounted = false;
    };
  }, [fetchRunPosts, page, initialLoadComplete]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 300
      ) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  const handleCommentClick = (postId) => {
    if (!loadedSupplementaryData.has(postId)) {
      loadSupplementaryData(postId);
    }
    
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, showComments: !post.showComments }
          : post
      )
    );
  };

  const handleLike = async (post) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    if (!window.nostr) {
      alert('Please login to like posts');
      return;
    }

    try {
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', post.id],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      const signedEvent = await window.nostr.signEvent(likeEvent);

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setUserLikes(prev => {
        const newLikes = new Set(prev);
        newLikes.add(post.id);
        return newLikes;
      });

      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === post.id 
            ? { ...p, likes: p.likes + 1 } 
            : p
        );
      });

      console.log('Post liked successfully');
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Failed to like post: ' + error.message);
    }
  };

  const handleRepost = async (post) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    if (!window.nostr) {
      alert('Please login to repost');
      return;
    }

    try {
      const repostEvent = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', post.id, '', 'mention'],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      const signedEvent = await window.nostr.signEvent(repostEvent);

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setUserReposts(prev => {
        const newReposts = new Set(prev);
        newReposts.add(post.id);
        return newReposts;
      });

      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === post.id 
            ? { ...p, reposts: p.reposts + 1 } 
            : p
        );
      });

      console.log('Post reposted successfully');
      alert('Post reposted successfully!');
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost: ' + error.message);
    }
  };

  const handleZap = async (post) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }

    if (!window.nostr) {
      alert('Please login to send zaps');
      return;
    }

    if (!wallet) {
      alert('Please connect a Bitcoin wallet to send zaps');
      return;
    }

    try {
      console.log('Author profile details:', {
        name: post.author.profile.name,
        pubkey: post.author.pubkey,
        lud16: post.author.lud16,
        lud06: post.author.lud06,
      });

      if (!post.author.lud16 && !post.author.lud06) {
        console.log('Author profile:', post.author);
        alert('This user has not set up their Lightning address in their Nostr profile');
        return;
      }

      try {
        console.log(`Attempting to zap ${defaultZapAmount} sats using NDK...`);
        
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.id = post.id;
        ndkEvent.pubkey = post.author.pubkey;
        
        if (!ndkEvent.zap) {
          console.warn('NDK zap method not available. Your NDK version may be outdated.');
          throw new Error('NDK zap method not available');
        }
        
        const zapResult = await ndkEvent.zap(
          defaultZapAmount,
          async (invoice) => {
            console.log('Paying invoice with wallet:', invoice.substring(0, 30) + '...');
            return await wallet.makePayment(invoice);
          },
          'Zap for your run! ⚡️'
        );
        
        console.log('NDK Zap successful! Result:', zapResult);
        
        setPosts(currentPosts => 
          currentPosts.map(p => {
            if (p.id === post.id) {
              return {
                ...p,
                zaps: p.zaps + 1,
                zapAmount: p.zapAmount + defaultZapAmount
              };
            }
            return p;
          })
        );

        alert('Zap sent successfully! ⚡️');
        return;
      } catch (ndkZapError) {
        console.error('NDK zap error:', ndkZapError);
        console.warn('NDK zap failed, falling back to manual approach');
      }
        
      console.log('Using fallback manual zap implementation...');
      
      const lnurl = post.author.lud16 || post.author.lud06;
      
      const zapEvent = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', (defaultZapAmount * 1000).toString()],
        ],
        pubkey: await window.nostr.getPublicKey()
      };
      
      const signedEvent = await window.nostr.signEvent(zapEvent);
      
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      console.log('Published zap request event:', ndkEvent);
      
      let zapEndpoint;
      if (lnurl.includes('@')) {
        const [username, domain] = lnurl.split('@');
        zapEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
        console.log('Using lud16 Lightning address:', lnurl);
      } else {
        zapEndpoint = lnurl;
        console.log('Using lud06 LNURL:', lnurl);
      }
      
      console.log('Fetching LNURL-pay metadata from:', zapEndpoint);
      const response = await fetch(zapEndpoint);
      const lnurlPayData = await response.json();
      console.log('LNURL-pay metadata:', lnurlPayData);
      
      if (!lnurlPayData.callback) {
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }
      
      const amount = defaultZapAmount * 1000;
      
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      callbackUrl.searchParams.append('nostr', JSON.stringify(signedEvent));
      
      console.log('Requesting invoice from:', callbackUrl.toString());
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();
      console.log('Invoice data:', invoiceData);
      
      if (!invoiceData.pr) {
        throw new Error(
          'Invalid invoice response: missing payment request'
        );
      }
      
      await wallet.makePayment(invoiceData.pr);
      
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              zaps: p.zaps + 1,
              zapAmount: p.zapAmount + defaultZapAmount
            };
          }
          return p;
        })
      );
      
      alert('Zap sent successfully! ⚡️');

    } catch (error) {
      console.error('Error sending zap:', error);
      
      let errorMessage = 'Failed to send zap: ';
      
      if (error.message.includes('LNURL') || error.message.includes('Lightning')) {
        errorMessage += 'There was an issue with the Lightning address. The receiver might need to update their LNURL configuration.';
      } else if (error.message.includes('wallet') || error.message.includes('provider')) {
        errorMessage += 'Could not connect to your Lightning wallet. Please make sure you have a Lightning wallet installed and configured.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage += `Network error: ${error.message}. This could be due to CORS issues or the service being unavailable.`;
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleComment = async (postId) => {
    if (!loadedSupplementaryData.has(postId)) {
      await loadSupplementaryData(postId);
    }
    
    if (!commentText.trim() || !window.nostr) {
      alert('Please login and enter a comment');
      return;
    }

    try {
      const commentEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId, '', 'reply'],
          ['k', '1']
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      const signedEvent = await window.nostr.signEvent(commentEvent);

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setCommentText('');
      fetchRunPosts();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  const extractImagesFromContent = (content) => {
    const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    return content.match(urlRegex) || [];
  };

  const checkPostVisibility = useCallback(() => {
    const postElements = document.querySelectorAll('.post-card');
    
    postElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const postId = element.getAttribute('data-post-id');
      
      if (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      ) {
        if (postId && !loadedSupplementaryData.has(postId)) {
          loadSupplementaryData(postId);
        }
      }
    });
  }, [loadSupplementaryData, loadedSupplementaryData]);

  useEffect(() => {
    const handleVisibilityCheck = () => {
      checkPostVisibility();
    };

    if (!loading && posts.length > 0) {
      setTimeout(handleVisibilityCheck, 500);
    }

    window.addEventListener('scroll', handleVisibilityCheck);
    return () => window.removeEventListener('scroll', handleVisibilityCheck);
  }, [loading, posts, checkPostVisibility]);

  // Format split times correctly in post content
  const formatSplitTimesInContent = (content) => {
    if (!content) return content;
    
    // Check if the content contains splits section
    if (!content.includes('📊 Splits:')) return content;
    
    // Split the content into lines
    const lines = content.split('\n');
    
    // Process each line
    const formattedLines = lines.map(line => {
      // Check if this is a split line - handles both formats:
      // - Old format with very large numbers: "Mile 1: 11350:34" or "Mile 25: 1081263:38"
      // - New format: "Mile 1: 8:16" or sequential miles with proper time format
      const splitRegex = /(Mile|Km)\s+(\d+\.?\d*):\s+(\d+:\d+:\d+|\d+:\d+|\d+)/i;
      const match = line.match(splitRegex);
      
      if (match) {
        const unit = match[1]; // "Mile" or "Km"
        const number = parseFloat(match[2]);
        const time = match[3];
        
        // If already in the new format (whole number), keep it as is
        const wholeNumber = Number.isInteger(number) ? number : Math.round(number);
        
        // If time format is valid (like 8:43) keep it, otherwise convert
        let formattedTime = time;
        
        // Handle the large number cases seen in the issue (e.g., 11350:34, 1081263:38)
        if (time.includes(':')) {
          // Already has a colon - could be valid MM:SS format or problematic large number format
          const parts = time.split(':');
          
          // Check if the first part is unusually large (more than 3 digits), indicating an error
          if (parts[0].length > 3) {
            // For values like "11350:34" convert to more sensible format
            // In this case, try to interpret as minutes and seconds
            const minutes = parseInt(parts[0]) % 60; // Get just the minutes part
            const seconds = parseInt(parts[1]);
            formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        } else if (!isNaN(parseInt(time))) {
          // Handle single large number with no colon
          const timeNumber = parseInt(time);
          if (timeNumber > 1000) {
            // Try to convert a number like 8816 to 8:16
            const minutes = Math.floor((timeNumber % 10000) / 100);
            const seconds = timeNumber % 100;
            formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          } else {
            // For smaller numbers, assume it's just seconds
            const minutes = Math.floor(timeNumber / 60);
            const seconds = timeNumber % 60;
            formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        }
        
        return `${unit} ${wholeNumber}: ${formattedTime}`;
      }
      
      return line;
    });
    
    return formattedLines.join('\n');
  };

  return (
    <div className="run-club-container">
      <h2>RUNSTR FEED</h2>
      {loading && page === 1 ? (
        <div className="loading-indicator">Loading posts...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : posts.length === 0 ? (
        <div className="no-posts-message">No running posts found</div>
      ) : (
        <div className="posts-container">
          {posts.map((post) => (
            <div key={post.id} className="post-card" data-post-id={post.id}>
              <div className="post-header">
                <img
                  src={post.author.profile.picture || '/default-avatar.png'}
                  alt={post.author.profile.name || 'Anonymous'}
                  className="author-avatar"
                  loading="lazy"
                />
                <div className="author-info">
                  <h4>{post.author.profile.name || 'Anonymous Runner'}</h4>
                  <span>
                    {new Date(post.created_at * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="post-content">
                {formatSplitTimesInContent(post.content)}
                <div className="post-images">
                  {extractImagesFromContent(post.content).map(
                    (imageUrl, index) => (
                      <img
                        key={index}
                        src={imageUrl}
                        alt="Run activity"
                        className="post-image"
                        onClick={() => window.open(imageUrl, '_blank')}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="post-actions">
                <button
                  className="zap-button"
                  onClick={() => handleZap(post)}
                >
                  ⚡️ {post.zaps > 0 ? post.zaps : ''}
                </button>
                <button
                  className={`like-button ${userLikes.has(post.id) ? 'liked' : ''}`}
                  onClick={() => handleLike(post)}
                >
                  {userLikes.has(post.id) ? '❤️' : '🤍'} {post.likes > 0 ? post.likes : ''}
                </button>
                <button
                  className={`repost-button ${userReposts.has(post.id) ? 'reposted' : ''}`}
                  onClick={() => handleRepost(post)}
                >
                  {userReposts.has(post.id) ? '🔁' : '🔄'} {post.reposts > 0 ? post.reposts : ''}
                </button>
                <button
                  className="comment-button"
                  onClick={() => handleCommentClick(post.id)}
                >
                  💬 {post.comments?.length || 0}
                </button>
              </div>
              {post.showComments && (
                <div className="comments-section">
                  <div className="comments-list">
                    {post.comments?.map((comment) => (
                      <div key={comment.id} className="comment-item">
                        <img
                          src={
                            comment.author.profile.picture ||
                            '/default-avatar.png'
                          }
                          alt={comment.author.profile.name}
                          className="comment-avatar"
                        />
                        <div className="comment-content">
                          <strong>
                            {comment.author.profile.name || 'Anonymous'}
                          </strong>
                          <p>{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="comment-input">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === 'Enter' && handleComment(post.id)
                      }
                    />
                    <button onClick={() => handleComment(post.id)}>
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && page > 1 && (
            <div className="loading-more">Loading more posts...</div>
          )}
        </div>
      )}
    </div>
  );
};