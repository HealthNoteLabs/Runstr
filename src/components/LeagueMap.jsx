import { useState, useEffect, useMemo } from 'react';
import { useLeaguePosition } from '../hooks/useLeaguePosition';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';
import { getSeasonTitle, getActivityText } from '../config/seasonConfig';

export const LeagueMap = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const { publicKey } = useNostr();
  
  // Get comprehensive leaderboard data with caching
  const {
    leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    lastUpdated,
    refresh: refreshLeaderboard,
    activityMode
  } = useLeagueLeaderboard();

  // Get profiles for leaderboard users
  const leaderboardPubkeys = useMemo(() => 
    leaderboard.map(user => user.pubkey), [leaderboard]
  );
  const { profiles } = useProfiles(leaderboardPubkeys);

  // Enhanced leaderboard with profile data
  const enhancedLeaderboard = useMemo(() => {
    return leaderboard.map(user => {
      // Fix: useProfiles returns an object, not a Map
      const profile = profiles?.[user.pubkey] || profiles?.get?.(user.pubkey) || {};
      return {
        ...user,
        displayName: profile.display_name || profile.name || `Runner ${user.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        isCurrentUser: user.pubkey === publicKey
      };
    });
  }, [leaderboard, profiles, publicKey]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
  };

  // Calculate distributed positions for distance ranking (no completion-based positioning)
  const calculateDistributedPositions = (users) => {
    if (users.length === 0) return [];
    
    const TRACK_WIDTH = 320; // SVG track width in pixels
    const TRACK_START = 40;  // SVG track start position
    const TRACK_END = 360;   // SVG track end position
    const MIN_SPACING = 15;  // Minimum pixels between dots (increased for better visibility)
    
    // Sort users by distance (maintaining ranking order)
    const sortedUsers = [...users].sort((a, b) => b.totalMiles - a.totalMiles);
    
    // Calculate positions based on relative distance spread (not completion percentage)
    const maxDistance = sortedUsers[0]?.totalMiles || 0;
    const minDistance = sortedUsers[sortedUsers.length - 1]?.totalMiles || 0;
    const distanceRange = maxDistance - minDistance;
    
    // Calculate ideal positions based on distance ranking
    let positions = sortedUsers.map((user, index) => {
      let positionX;
      if (distanceRange === 0 || sortedUsers.length === 1) {
        // All users have same distance or single user
        positionX = TRACK_START + (TRACK_WIDTH * 0.8); // Place near end
      } else {
        // Spread users across track based on their relative distances
        const relativePosition = (user.totalMiles - minDistance) / distanceRange;
        positionX = TRACK_START + (relativePosition * TRACK_WIDTH * 0.8); // Use 80% of track
      }
      
      return {
        ...user,
        idealX: positionX,
        adjustedX: positionX
      };
    });
    
    // Multi-pass algorithm to resolve all conflicts
    let hasConflicts = true;
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    
    while (hasConflicts && iteration < maxIterations) {
      hasConflicts = false;
      iteration++;
      
      // Check each pair of adjacent users (in ranking order)
      for (let i = 0; i < positions.length - 1; i++) {
        const currentUser = positions[i];
        const nextUser = positions[i + 1];
        
        const distance = currentUser.adjustedX - nextUser.adjustedX;
        
        if (distance < MIN_SPACING) {
          hasConflicts = true;
          
          // Calculate how much we need to separate them
          const adjustment = (MIN_SPACING - distance) / 2;
          
          // Move current user forward and next user backward
          currentUser.adjustedX = Math.min(TRACK_END - 5, currentUser.adjustedX + adjustment);
          nextUser.adjustedX = Math.max(TRACK_START, nextUser.adjustedX - adjustment);
          
          // If we can't move the leading user forward enough, move the trailing user back more
          if (currentUser.adjustedX - nextUser.adjustedX < MIN_SPACING) {
            nextUser.adjustedX = currentUser.adjustedX - MIN_SPACING;
            nextUser.adjustedX = Math.max(TRACK_START, nextUser.adjustedX);
          }
        }
      }
    }
    
    // Final pass: ensure no one goes beyond track boundaries and maintain minimum spacing
    for (let i = 0; i < positions.length; i++) {
      positions[i].adjustedX = Math.max(TRACK_START, Math.min(TRACK_END - 5, positions[i].adjustedX));
    }
    
    // If users are still bunched up at the start, spread them out evenly
    const startLineUsers = positions.filter(p => p.adjustedX <= TRACK_START + MIN_SPACING);
    if (startLineUsers.length > 1) {
      for (let i = 0; i < startLineUsers.length; i++) {
        startLineUsers[i].adjustedX = TRACK_START + (i * MIN_SPACING);
      }
    }
    
    return positions;
  };

  // Calculate positions for leaderboard users on the track
  const racePositions = useMemo(() => {
    const topUsers = enhancedLeaderboard.slice(0, 10);
    return calculateDistributedPositions(topUsers);
  }, [enhancedLeaderboard]);

  // Loading state with lazy loading support
  const isLoading = isInitialLoad || (leaderboardLoading && leaderboard.length === 0);
  
  if (isLoading) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <div className="flex space-x-1 mb-3">
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
          </div>
          <p className="text-text-secondary">Loading League Race...</p>
        </div>
      </div>
    );
  }

  if (leaderboardError && leaderboard.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <p className="text-red-400 text-sm mb-2">Error loading league data: {leaderboardError}</p>
          <button 
            onClick={refreshLeaderboard}
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Distance Competition Track */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-text-primary">{getSeasonTitle(activityMode)}</h3>
          <div className="text-xs text-text-secondary">
            {lastUpdated && `Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
          </div>
        </div>
        
        <div className="relative">
          <svg 
            viewBox="0 0 400 100" 
            className="w-full h-24 race-track-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Track line */}
            <line 
              x1="40" y1="60" x2="360" y2="60" 
              stroke="currentColor" 
              strokeWidth="4" 
              strokeLinecap="round"
              className="text-text-muted"
            />
            
            {/* Start line */}
            <line 
              x1="40" y1="50" x2="40" y2="70" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="text-text-primary"
            />
            <text x="40" y="45" fontSize="10" textAnchor="middle" fill="currentColor" className="text-text-secondary">START</text>
            
            {/* Season Progress Text (no finish line for distance competition) */}
            <text x="360" y="45" fontSize="10" textAnchor="middle" fill="currentColor" className="text-text-secondary">
              SEASON
            </text>
            
            {/* Position runners on track */}
            {racePositions.map((user, index) => {
              const colors = {
                1: '#FFD700', // Gold
                2: '#C0C0C0', // Silver  
                3: '#CD7F32', // Bronze
                default: '#6B7280' // Gray
              };
              const color = colors[user.rank] || colors.default;
              
              return (
                <g key={user.pubkey}>
                  {/* Position dot */}
                  <circle 
                    cx={user.adjustedX} 
                    cy="60" 
                    r="6" 
                    fill={color}
                    stroke={user.isCurrentUser ? "#FF6B35" : "#000"}
                    strokeWidth={user.isCurrentUser ? "2" : "1"}
                    className="drop-shadow-sm"
                  />
                  
                  {/* Rank number */}
                  <text 
                    x={user.adjustedX} 
                    y="64" 
                    fontSize="10" 
                    fontWeight="bold"
                    textAnchor="middle" 
                    fill="#000"
                  >
                    {user.rank}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Distance-Based Leaderboard */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-bg-tertiary">
          <h3 className="text-lg font-semibold text-text-primary">🏆 Season Rankings</h3>
          {leaderboardLoading && (
            <div className="flex items-center">
              <div className="flex space-x-1">
                <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
                <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
                <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
              </div>
            </div>
          )}
        </div>
        
        {enhancedLeaderboard.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-text-secondary">
              No {activityMode === 'run' ? 'runners' : activityMode === 'walk' ? 'walkers' : 'cyclists'} found yet. Be the first to start!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {enhancedLeaderboard.slice(0, 10).map((user) => (
              <div 
                key={user.pubkey} 
                className={`flex items-center justify-between p-4 ${
                  user.isCurrentUser ? 'bg-primary/5 border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Rank Badge */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${user.rank === 1 ? 'bg-yellow-500 text-black' : ''}
                    ${user.rank === 2 ? 'bg-gray-400 text-black' : ''}
                    ${user.rank === 3 ? 'bg-orange-600 text-white' : ''}
                    ${user.rank > 3 ? 'bg-bg-tertiary text-text-secondary border border-border-secondary' : ''}
                  `}>
                    {user.rank}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary truncate">
                        {user.displayName}
                      </span>
                      {user.isCurrentUser && (
                        <span className="px-2 py-1 bg-primary text-text-primary text-xs rounded-full font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {getActivityText(user.runCount, activityMode)}
                    </div>
                  </div>
                </div>
                
                {/* Distance Stats (no completion percentage) */}
                <div className="text-right">
                  <div className="font-semibold text-text-primary">
                    {formatDistance(user.totalMiles)} mi
                  </div>
                  <div className="text-xs text-text-secondary">
                    Total distance
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
