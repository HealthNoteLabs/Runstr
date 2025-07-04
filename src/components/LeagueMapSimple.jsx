import React from 'react';

export const LeagueMapSimple = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  console.log('🔍 LeagueMapSimple: Rendering with props:', { 
    feedPostsLength: feedPosts?.length || 0, 
    feedLoading, 
    feedError
  });

  return (
    <div className="space-y-4 mb-4">
      {/* Test Header */}
      <div className="bg-red-500 text-white p-4 rounded-lg">
        <h1 className="text-2xl font-bold">🚨 LEAGUE MAP TEST</h1>
        <p>If you can see this red box, the component is rendering!</p>
        <p>Feed posts: {feedPosts?.length || 0}</p>
        <p>Loading: {feedLoading ? 'true' : 'false'}</p>
        <p>Error: {feedError || 'none'}</p>
      </div>

      {/* Season Pass Section */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-text-primary">RUNSTR SEASON 1</h3>
          <button className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md font-semibold hover:bg-primary/80 transition-colors">
            🎫 Season Pass
          </button>
        </div>
        
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div>
                <div className="text-xl font-bold text-text-primary mb-1">Total Prize Pool</div>
                <div className="text-text-secondary text-sm">200,000 SATS total</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Feed Section */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">🏃 Recent Activities</h3>
        
        {feedLoading ? (
          <p className="text-text-secondary">Loading feed...</p>
        ) : feedError ? (
          <p className="text-red-400">Error: {feedError}</p>
        ) : feedPosts?.length === 0 ? (
          <p className="text-text-secondary">No activities found. Season Pass participants' runs will appear here.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-text-primary">Found {feedPosts.length} activities</p>
            {feedPosts.slice(0, 3).map((post, idx) => (
              <div key={idx} className="bg-bg-tertiary p-3 rounded border border-border-secondary">
                <p className="text-text-primary text-sm">Activity {idx + 1}</p>
                <p className="text-text-secondary text-xs">ID: {post.id}</p>
              </div>
            ))}
            {feedPosts.length > 3 && (
              <p className="text-text-secondary text-sm">... and {feedPosts.length - 3} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueMapSimple; 