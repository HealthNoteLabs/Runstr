import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from '../contexts/WalletContext.jsx';
import { useRunFeed } from '../hooks/useRunFeed';
import { useLeagueRunFeed } from '../hooks/useLeagueRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { LeagueMap } from '../components/LeagueMap';
import { Season1SubscriptionCard } from '../components/Season1SubscriptionCard';
import { handleAppBackground } from '../utils/nostr';
import '../components/RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useContext(WalletContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'participants'
  
  // Enhanced league feed with subscription filtering
  const leagueFeed = useLeagueRunFeed();
  
  // Fallback to original feed hook to maintain compatibility
  const originalFeed = useRunFeed('RUNSTR');
  
  // Use league feed if available, otherwise fallback to original
  const feedToUse = leagueFeed.allPosts.length > 0 || leagueFeed.subscriptionsLoading ? leagueFeed : originalFeed;
  
  // Determine posts to display based on view mode
  const postsToDisplay = viewMode === 'participants' && leagueFeed.participantPosts 
    ? leagueFeed.participantPosts 
    : feedToUse.allPosts || feedToUse.posts;
  
  // Interaction hook (using the posts that will be displayed)
  const {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts: postsToDisplay,
    setPosts: feedToUse.setPosts || (() => {}), // Fallback for compatibility
    setUserLikes: feedToUse.setUserLikes,
    setUserReposts: feedToUse.setUserReposts,
    loadSupplementaryData: feedToUse.loadSupplementaryData,
    loadedSupplementaryData: feedToUse.loadedSupplementaryData,
    defaultZapAmount
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleAppBackground();
    };
  }, []);

  // Refresh feed helper - works with both feed types
  const refreshFeed = () => {
    if (feedToUse.loading || isRefreshing) return;
    setIsRefreshing(true);
    const refreshPromise = feedToUse.fetchRunPostsViaSubscription 
      ? feedToUse.fetchRunPostsViaSubscription()
      : Promise.resolve();
    refreshPromise.finally(() => setTimeout(() => setIsRefreshing(false), 500));
  };

  // Hard refresh with cache clearing
  const hardRefresh = () => {
    if (feedToUse.loading || isRefreshing) return;
    setIsRefreshing(true);
    feedToUse.clearCacheAndRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="runclub-container">
      {/* Add debug button for development builds */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', top: '80px', right: '10px', zIndex: 1000 }}>
          <button 
            onClick={hardRefresh}
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            disabled={feedToUse.loading || isRefreshing}
          >
            🗑️ Clear Cache
          </button>
        </div>
      )}
      
      {/* Season 1 Subscription Card */}
      <Season1SubscriptionCard className="season1-card" />
      
      {/* View Mode Toggle */}
      <div className="league-controls">
        <div className="view-toggle">
          <button 
            className={viewMode === 'all' ? 'active' : ''}
            onClick={() => setViewMode('all')}
          >
            All Runners ({(feedToUse.allPosts || feedToUse.posts || []).length})
          </button>
          <button 
            className={viewMode === 'participants' ? 'active' : ''}
            onClick={() => setViewMode('participants')}
            disabled={leagueFeed.subscriptionsLoading}
          >
            Season 1 Participants ({leagueFeed.participantPosts.length})
            {leagueFeed.subscriptionsLoading && ' (Loading...)'}
          </button>
        </div>
        
        {leagueFeed.subscribers.size > 0 && (
          <div className="subscriber-stats">
            {leagueFeed.subscribers.size} subscribers • {leagueFeed.captains.size} captains
          </div>
        )}
      </div>
      
      {/* League Map Component */}
      <LeagueMap />
      
      {/* PostList Component for workout feed */}
      <PostList
        posts={postsToDisplay}
        loading={feedToUse.loading}
        error={feedToUse.error}
        userLikes={feedToUse.userLikes}
        userReposts={feedToUse.userReposts}
        onLike={handleLike}
        onRepost={handleRepost}
        onZap={handleZap}
        onComment={handleComment}
        onCommentClick={handleCommentClick}
        onLoadMore={feedToUse.loadMorePosts}
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