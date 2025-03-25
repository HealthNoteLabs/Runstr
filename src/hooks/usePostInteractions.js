import { useState, useCallback } from 'react';
import { createAndPublishEvent, loadSupplementaryData } from '../utils/nostr';

export const usePostInteractions = ({
  posts,
  setPosts,
  setUserLikes,
  setUserReposts,
  loadSupplementaryData,
  defaultZapAmount
}) => {
  const [commentText, setCommentText] = useState('');
  const [activeCommentPost, setActiveCommentPost] = useState(null);

  const handleCommentClick = useCallback((post) => {
    setPosts(currentPosts => 
      currentPosts.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            showComments: !p.showComments
          };
        }
        return p;
      })
    );
  }, [setPosts]);

  const handleLike = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please install a Nostr extension to like posts');
      return;
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      
      // Create like event
      const event = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', post.id]],
        content: '+'
      };

      // Sign and publish event
      const signedEvent = await window.nostr.signEvent(event);
      await fetch('https://relay.damus.io', {
        method: 'POST',
        body: JSON.stringify(['EVENT', signedEvent])
      });

      // Update UI optimistically
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes: (p.likes || 0) + 1
            };
          }
          return p;
        })
      );

      // Update user's likes
      setUserLikes(prev => {
        const newLikes = new Set(prev);
        newLikes.add(post.id);
        return newLikes;
      });

      // Reload supplementary data to ensure accuracy
      const data = await loadSupplementaryData(post.id);
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes: data.likes,
              reposts: data.reposts,
              zaps: data.zaps
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Failed to like post: ' + error.message);
    }
  }, [setPosts, setUserLikes, loadSupplementaryData]);

  const handleRepost = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please install a Nostr extension to repost');
      return;
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      
      // Create repost event
      const event = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', post.id]],
        content: ''
      };

      // Sign and publish event
      const signedEvent = await window.nostr.signEvent(event);
      await fetch('https://relay.damus.io', {
        method: 'POST',
        body: JSON.stringify(['EVENT', signedEvent])
      });

      // Update UI optimistically
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              reposts: (p.reposts || 0) + 1
            };
          }
          return p;
        })
      );

      // Update user's reposts
      setUserReposts(prev => {
        const newReposts = new Set(prev);
        newReposts.add(post.id);
        return newReposts;
      });

      // Reload supplementary data to ensure accuracy
      const data = await loadSupplementaryData(post.id);
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes: data.likes,
              reposts: data.reposts,
              zaps: data.zaps
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost: ' + error.message);
    }
  }, [setPosts, setUserReposts, loadSupplementaryData]);

  const handleComment = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please install a Nostr extension to comment');
      return;
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      
      // Create comment event
      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', post.id]],
        content: commentText
      };

      // Sign and publish event
      const signedEvent = await window.nostr.signEvent(event);
      await fetch('https://relay.damus.io', {
        method: 'POST',
        body: JSON.stringify(['EVENT', signedEvent])
      });

      // Clear comment text
      setCommentText('');

      // Reload supplementary data to ensure accuracy
      const data = await loadSupplementaryData(post.id);
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes: data.likes,
              reposts: data.reposts,
              zaps: data.zaps
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Error commenting:', error);
      alert('Failed to post comment: ' + error.message);
    }
  }, [commentText, setCommentText, setPosts, loadSupplementaryData]);

  const handleZap = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please install a Nostr extension to zap');
      return;
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      
      // Create zap event
      const event = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', defaultZapAmount.toString()],
          ['relays', 'wss://relay.damus.io', 'wss://nos.lol']
        ],
        content: 'Zap for your run! ⚡️'
      };

      // Sign and publish event
      const signedEvent = await window.nostr.signEvent(event);
      await fetch('https://relay.damus.io', {
        method: 'POST',
        body: JSON.stringify(['EVENT', signedEvent])
      });

      // Update UI optimistically
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              zaps: (p.zaps || 0) + 1
            };
          }
          return p;
        })
      );

      // Reload supplementary data to ensure accuracy
      const data = await loadSupplementaryData(post.id);
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes: data.likes,
              reposts: data.reposts,
              zaps: data.zaps
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Error zapping:', error);
      alert('Failed to send zap: ' + error.message);
    }
  }, [defaultZapAmount, setPosts, loadSupplementaryData]);

  return {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleComment,
    handleZap,
    activeCommentPost
  };
}; 