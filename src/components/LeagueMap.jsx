import { useState, useEffect, useMemo } from 'react';
import { useLeaguePosition } from '../hooks/useLeaguePosition';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';

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

  // Generate dynamic league title based on activity mode
  const getLeagueTitle = () => {
    if (!activityMode) return 'RUNSTR Season 1'; // Fallback for loading state
    
    switch (activityMode) {
      case 'run':
        return 'RUNSTR Season 1 • Running';
      case 'walk':
        return 'RUNSTR Season 1 • Walking';
      case 'cycle':
        return 'RUNSTR Season 1 • Cycling';
      default:
        return 'RUNSTR Season 1';
    }
  };

  // Generate dynamic activity text based on activity mode
  const getActivityText = (count) => {
    if (!activityMode) return `${count} run${count !== 1 ? 's' : ''}`; // Fallback
    
    switch (activityMode) {
      case 'run':
        return `${count} run${count !== 1 ? 's' : ''}`;
      case 'walk':
        return `${count} walk${count !== 1 ? 's' : ''}`;
      case 'cycle':
        return `${count} ride${count !== 1 ? 's' : ''}`;
      default:
        return `${count} run${count !== 1 ? 's' : ''}`;
    }
  };

  // Calculate position along race track (0-100%) - now based on relative distance rather than fixed course
  const calculateTrackPosition = (totalMiles) => {
    if (enhancedLeaderboard.length === 0) return 0;
    const maxDistance = enhancedLeaderboard[0]?.totalMiles || 1;
    return Math.min(100, (totalMiles / Math.max(maxDistance, 1)) * 100);
  };

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
  };

  // Calculate distributed positions to prevent overlapping
  const calculateDistributedPositions = (users) => {
    if (users.length === 0) return [];
    
    const TRACK_WIDTH = 320; // SVG track width in pixels
    const TRACK_START = 40;  // SVG track start position
    const TRACK_END = 360;   // SVG track end position
    const MIN_SPACING = 15;  // Minimum pixels between dots (increased for better visibility)
    
    // Sort users by distance (maintaining ranking order)
    const sortedUsers = [...users].sort((a, b) => b.totalMiles - a.totalMiles);
    
    // Calculate ideal positions based on actual progress
    let positions = sortedUsers.map(user => ({
      ...user,
      idealX: TRACK_START + (calculateTrackPosition(user.totalMiles) / 100 * TRACK_WIDTH),
      adjustedX: TRACK_START + (calculateTrackPosition(user.totalMiles) / 100 * TRACK_WIDTH)
    }));
    
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
      {/* Linear Race Track */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-text-primary">{getLeagueTitle()}</h3>
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
            
            {/* Dynamic distance markers based on current leaderboard leader */}
            {enhancedLeaderboard.length > 0 && (() => {
              const maxDistance = enhancedLeaderboard[0]?.totalMiles || 0;
              const markers = [];
              
              // Create markers at 25%, 50%, 75% of leader's distance
              if (maxDistance > 0) {
                [0.25, 0.5, 0.75].forEach(fraction => {
                  const markerDistance = maxDistance * fraction;
                  const x = 40 + (fraction * 320);
                  
                  markers.push(
                    <g key={fraction}>
                      <line 
                        x1={x} y1="55" x2={x} y2="65" 
                        stroke="currentColor" 
                        strokeWidth="1" 
                        className="text-text-muted"
                      />
                      <text x={x} y="80" fontSize="8" textAnchor="middle" fill="currentColor" className="text-text-muted">
                        {markerDistance.toFixed(0)}mi
                      </text>
                    </g>
                  );
                });
              }
              
              return markers;
            })()}
          </svg>
        </div>
      </div>

      {/* Workout-Card-Styled Leaderboard */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-bg-tertiary">
          <h3 className="text-lg font-semibold text-text-primary">🏆 League Standings</h3>
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
                      {getActivityText(user.runCount)}
                    </div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="text-right">
                  <div className="font-semibold text-text-primary">
                    {formatDistance(user.totalMiles)} mi
                  </div>
                  <div className="text-xs text-text-secondary">
                    Season 1 Participant
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
