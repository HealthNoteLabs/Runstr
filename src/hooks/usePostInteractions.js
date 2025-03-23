import { useState, useCallback } from 'react';
import { createAndPublishEvent, getUserPublicKey } from '../utils/nostr';

export const usePostInteractions = ({
  posts,
  setPosts,
  setUserLikes,
  setUserReposts,
  loadSupplementaryData,
  loadedSupplementaryData,
  defaultZapAmount
}) => {
  const [commentText, setCommentText] = useState('');

  const handleCommentClick = useCallback((postId) => {
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
  }, [posts, setPosts, loadSupplementaryData, loadedSupplementaryData]);

  const handleLike = useCallback(async (post) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    try {
      // Get user's pubkey using Android-specific method
      const userPubkey = await getUserPublicKey();
      
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', post.id],
          ['p', post.author.pubkey]
        ],
        pubkey: userPubkey
      };

      const publishedEvent = await createAndPublishEvent(likeEvent);

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

      console.log('Post liked successfully on Android');
      return publishedEvent;
    } catch (error) {
      console.error('Error liking post on Android:', error);
      // Use Android toast or notification instead of alert
      console.warn('Failed to like post: ' + error.message);
    }
  }, [loadSupplementaryData, loadedSupplementaryData, setPosts, setUserLikes]);

  const handleRepost = useCallback(async (post) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    try {
      // Get user's pubkey using Android-specific method
      const userPubkey = await getUserPublicKey();
      
      const repostEvent = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', post.id, '', 'mention'],
          ['p', post.author.pubkey]
        ],
        pubkey: userPubkey
      };

      const publishedEvent = await createAndPublishEvent(repostEvent);

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

      console.log('Post reposted successfully on Android');
      return publishedEvent;
    } catch (error) {
      console.error('Error reposting on Android:', error);
      // Use Android toast or notification instead of alert
      console.warn('Failed to repost: ' + error.message);
    }
  }, [loadSupplementaryData, loadedSupplementaryData, setPosts, setUserReposts]);

  const handleZap = useCallback(async (post, wallet) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }

    // Find the author's Lightning address
    const lud16 = post.author.profile?.lud16;
    const lud06 = post.author.profile?.lud06;
    
    if (!lud16 && !lud06) {
      // Use Android toast or notification instead of alert
      console.warn('This user does not have a Lightning address set up');
      return;
    }

    try {
      // Call the zapInvoice method if it exists
      if (wallet && typeof wallet.zapInvoice === 'function') {
        const userPubkey = await getUserPublicKey();
        
        const result = await wallet.zapInvoice({
          lud16: lud16,
          lud06: lud06,
          amount: defaultZapAmount,
          comment: `Zap from RUNSTR for your running post`,
          eventId: post.id,
          authorId: post.author.pubkey,
          senderPubkey: userPubkey
        });
        
        console.log('Zap result on Android:', result);
        
        if (result && result.success) {
          setPosts(currentPosts => {
            return currentPosts.map(p => 
              p.id === post.id 
                ? { ...p, zaps: p.zaps + 1, zapAmount: p.zapAmount + (defaultZapAmount / 1000) } 
                : p
            );
          });
        }
        
        return result;
      } else {
        console.warn('Zapping not available on this device');
      }
    } catch (error) {
      console.error('Error zapping on Android:', error);
      // Use Android toast or notification instead of alert
      console.warn('Failed to zap: ' + error.message);
    }
  }, [loadSupplementaryData, loadedSupplementaryData, setPosts, defaultZapAmount]);

  const handleComment = useCallback(async (postId) => {
    if (!commentText.trim()) return;
    
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Get user's pubkey using Android-specific method
      const userPubkey = await getUserPublicKey();
      
      const commentEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId],
          ['p', post.author.pubkey]
        ],
        pubkey: userPubkey
      };

      const publishedEvent = await createAndPublishEvent(commentEvent);

      // For Android, use a simplified profile
      const profile = {
        name: 'RUNSTR User',
        about: 'Running on Nostr'
      };

      // Add the comment to the UI
      setPosts(currentPosts => {
        return currentPosts.map(p => {
          if (p.id === postId) {
            const newComment = {
              id: publishedEvent.id,
              content: commentText,
              created_at: commentEvent.created_at,
              author: {
                pubkey: userPubkey,
                profile: profile
              }
            };
            
            return {
              ...p,
              comments: [...p.comments, newComment]
            };
          }
          return p;
        });
      });

      setCommentText('');
      return publishedEvent;
    } catch (error) {
      console.error('Error commenting on Android:', error);
      // Use Android toast or notification instead of alert
      console.warn('Failed to post comment: ' + error.message);
    }
  }, [commentText, posts, setPosts]);

  return {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  };
}; 