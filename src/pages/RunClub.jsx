import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from '../contexts/WalletContext.jsx';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { LeagueMap } from '../components/LeagueMap';
import { handleAppBackground } from '../utils/nostr';
import '../components/RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useContext(WalletContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Feed hook with RUNSTR filtering for League tab
  const {
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
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    clearCacheAndRefresh
  } = useRunFeed('RUNSTR'); // Filter for RUNSTR app posts only
  
  // Interaction hook
  const {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts,
    setPosts,
    setUserLikes,
    setUserReposts,
    loadSupplementaryData,
    loadedSupplementaryData,
    defaultZapAmount
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleAppBackground();
    };
  }, []);

  // Refresh feed helper
  const refreshFeed = () => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    fetchRunPostsViaSubscription().finally(() => setTimeout(() => setIsRefreshing(false), 500));
  };

  // Hard refresh with cache clearing (for debugging RUNSTR filtering)
  const hardRefresh = () => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    clearCacheAndRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="runclub-container">
      {/* League Map Component */}
      <LeagueMap />
      
      {/* PostList Component for workout feed */}
      <PostList
        posts={posts}
        loading={loading}
        error={error}
        userLikes={userLikes}
        userReposts={userReposts}
        onLike={handleLike}
        onRepost={handleRepost}
        onZap={handleZap}
        onComment={handleComment}
        onCommentClick={handleCommentClick}
        onLoadMore={loadMorePosts}
        commentText={commentText}
        setCommentText={setCommentText}
        onRefresh={refreshFeed}
        isRefreshing={isRefreshing}
        defaultZapAmount={defaultZapAmount}
        wallet={wallet}
      />
    </div>
  );
};