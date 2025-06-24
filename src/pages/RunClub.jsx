import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useNDKWallet } from '../contexts/NDKWalletContext';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { LeagueMap } from '../components/LeagueMap';
import { handleAppBackground } from '../utils/nostr';
import '../components/RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useNDKWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Feed hook
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
    loadedSupplementaryData
  } = useRunFeed();
  
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

  return (
    <div className="league-page">
      {/* League Map at the top - pass feed data for leaderboard */}
      <LeagueMap feedPosts={posts} feedLoading={loading} feedError={error} />
      
      {/* League Feed - existing 1301 feed below */}
      <div className="league-feed">
        {loading && posts.length === 0 ? (
          <div className="loading-indicator"><p>Loading posts...</p></div>
        ) : error ? null : posts.length === 0 ? (
          <div className="no-posts-message">
            <p>No running posts found</p>
            <button className="retry-button" onClick={refreshFeed}>Refresh</button>
          </div>
        ) : (
          <PostList
            posts={posts}
            loading={loading}
            page={1}
            userLikes={userLikes}
            userReposts={userReposts}
            handleLike={handleLike}
            handleRepost={handleRepost}
            handleZap={(post) => handleZap(post, wallet)}
            handleCommentClick={handleCommentClick}
            handleComment={handleComment}
            commentText={commentText}
            setCommentText={setCommentText}
            wallet={wallet}
          />
        )}
      </div>
    </div>
  );
};