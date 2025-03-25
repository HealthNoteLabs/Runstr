import React, { useState, useEffect } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { handleAppLifecycle } from '../utils/nostr';

export const RunClub = () => {
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const { publicKey, isNostrReady, defaultZapAmount } = React.useContext(NostrContext);
  const { wallet } = useAuth();
  const {
    posts,
    loading,
    error,
    userLikes,
    userReposts,
    page,
    hasMore,
    loadMorePosts
  } = useRunFeed();

  const {
    handleLike,
    handleRepost,
    handleCommentClick,
    handleComment,
    handleZap
  } = usePostInteractions({
    posts,
    setPosts: () => {}, // We'll handle post updates in the feed hook
    setUserLikes: () => {}, // We'll handle user likes in the feed hook
    setUserReposts: () => {}, // We'll handle user reposts in the feed hook
    loadSupplementaryData,
    defaultZapAmount
  });

  // Handle app lifecycle events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleAppLifecycle('pause');
      } else {
        handleAppLifecycle('resume');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    try {
      setDiagnosticInfo('Testing Nostr connection...');
      const response = await fetch('https://relay.damus.io', {
        method: 'POST',
        body: JSON.stringify(['REQ', 'test', { limit: 1 }])
      });
      
      if (response.ok) {
        setDiagnosticInfo('Connected to Nostr relay successfully');
      } else {
        setDiagnosticInfo('Failed to connect to Nostr relay');
      }
    } catch (error) {
      setDiagnosticInfo(`Connection error: ${error.message}`);
    }
  };

  // Scroll handler for infinite scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && hasMore) {
      loadMorePosts();
    }
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading running posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={diagnoseConnection}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Running Community</h1>
        <p className="text-gray-600 mt-2">Connect with runners around the world</p>
      </div>

      {diagnosticInfo && (
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">{diagnosticInfo}</p>
        </div>
      )}

      <div
        className="space-y-6 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
      >
        <PostList
          posts={posts}
          loading={loading}
          page={page}
          userLikes={userLikes}
          userReposts={userReposts}
          handleLike={handleLike}
          handleRepost={handleRepost}
          handleCommentClick={handleCommentClick}
          handleComment={handleComment}
          handleZap={handleZap}
          wallet={wallet}
        />
      </div>
    </div>
  );
};