import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from '../contexts/WalletContext.jsx';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { LeagueMap } from '../components/LeagueMap';
import LeagueMapSimple from '../components/LeagueMapSimple';
import LeagueErrorBoundary from '../components/LeagueErrorBoundary';
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
            disabled={loading || isRefreshing}
          >
            🗑️ Clear Cache
          </button>
        </div>
      )}
      
      {/* League Map Component with Error Boundary */}
      <LeagueErrorBoundary>
        <LeagueMapSimple 
          feedPosts={posts}
          feedLoading={loading}
          feedError={error}
        />
      </LeagueErrorBoundary>
    </div>
  );
};