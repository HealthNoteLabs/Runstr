import React from 'react';
import { useRunFeed } from '../hooks/useRunFeed';

export const RunClub = () => {
  const { posts, loading, error, hasMore, loadMorePosts } = useRunFeed();

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-center">
          <p>Error loading running posts: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Running Feed</h1>
      
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
              <div>
                <p className="font-semibold">{post.pubkey.slice(0, 8)}...</p>
                <p className="text-sm text-gray-500">
                  {new Date(post.created_at * 1000).toLocaleString()}
                </p>
              </div>
            </div>
            
            <p className="mb-2">{post.content}</p>
            
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {post.tags
                  .filter(tag => tag[0] === 't')
                  .map((tag, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      #{tag[1]}
                    </span>
                  ))}
              </div>
            )}
            
            <div className="flex items-center space-x-4 text-gray-500">
              <button className="flex items-center space-x-1 hover:text-blue-500">
                <span>❤️</span>
                <span>{post.likes || 0}</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-green-500">
                <span>🔄</span>
                <span>{post.reposts || 0}</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-yellow-500">
                <span>⚡</span>
                <span>{post.zaps || 0}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMorePosts}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}; 