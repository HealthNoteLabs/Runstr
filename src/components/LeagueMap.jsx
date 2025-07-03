import { useState, useEffect, useMemo } from 'react';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';
import SeasonPassPaymentModal from './modals/SeasonPassPaymentModal';
import PrizePoolModal from './modals/PrizePoolModal';
import seasonPassPaymentService from '../services/seasonPassPaymentService';
import seasonPassService from '../services/seasonPassService';

export const LeagueMap = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showSeasonPassModal, setShowSeasonPassModal] = useState(false);
  const [showPrizePoolModal, setShowPrizePoolModal] = useState(false);
  
  const { publicKey } = useNostr();
  
  // Get comprehensive leaderboard data with caching
  const {
    leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    lastUpdated,
    refresh: refreshLeaderboard,
    courseTotal,
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
    if (!activityMode) return 'RUNSTR SEASON 1'; // Fallback for loading state
    
    switch (activityMode) {
      case 'run':
        return 'RUNSTR SEASON 1';
      case 'walk':
        return 'WALKSTR SEASON 1';
      case 'cycle':
        return 'CYCLESTR SEASON 1';
      default:
        return 'RUNSTR SEASON 1';
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

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
  };

  // Season Pass helpers
  const hasSeasonPass = useMemo(() => {
    return publicKey ? seasonPassPaymentService.hasSeasonPass(publicKey) : false;
  }, [publicKey]);

  const handleSeasonPassClick = () => {
    if (!publicKey) {
      alert('Please connect your Nostr account first');
      return;
    }
    setShowSeasonPassModal(true);
  };

  const handlePaymentSuccess = () => {
    // Refresh the leaderboard to show updated content
    refreshLeaderboard();
  };

  // Enhanced loading and empty state logic
  const getLeagueState = () => {
    // Still doing initial load
    if (isInitialLoad) {
      return { type: 'loading', message: 'Loading League Race...' };
    }
    
    // Currently loading with no cached data
    if (leaderboardLoading && leaderboard.length === 0) {
      return { type: 'loading', message: 'Loading League Race...' };
    }
    
    // Error with no fallback data
    if (leaderboardError && leaderboard.length === 0) {
      return { type: 'error', message: leaderboardError };
    }
    
    // Check Season Pass participants for empty state context
    const participantCount = seasonPassService.getParticipantCount();
    
    // No participants yet (pre-launch scenario)
    if (participantCount === 0) {
      return { 
        type: 'empty-participants', 
        message: 'No Season Pass participants yet. Be the first to join!' 
      };
    }
    
    // Have participants but no leaderboard data (launch day, no qualifying runs yet)
    if (leaderboard.length === 0) {
      const currentDate = new Date();
      const competitionStart = new Date('2025-07-11T00:00:00Z');
      
      if (currentDate < competitionStart) {
        return { 
          type: 'pre-competition', 
          message: `Competition starts July 11th, 2025. ${participantCount} runner${participantCount !== 1 ? 's' : ''} ready!` 
        };
      } else {
        return { 
          type: 'no-qualifying-runs', 
          message: `Competition is live! Waiting for first ${activityMode === 'run' ? 'runs' : activityMode === 'walk' ? 'walks' : 'rides'}...` 
        };
      }
    }
    
    // Normal state with data
    return { type: 'normal' };
  };

  const leagueState = getLeagueState();

  // Render appropriate state
  if (leagueState.type === 'loading') {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <div className="flex space-x-1 mb-3">
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-75"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-150"></span>
          </div>
          <p className="text-text-secondary">{leagueState.message}</p>
        </div>
      </div>
    );
  }

  if (leagueState.type === 'error') {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <p className="text-red-400 text-sm mb-2">Error loading league data: {leagueState.message}</p>
          <button 
            onClick={refreshLeaderboard}
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md hover:bg-primary/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle empty states (no participants, pre-competition, or no qualifying runs)
  if (leagueState.type !== 'normal') {
    return (
      <div className="space-y-4 mb-4">
        {/* Always show Season Pass section */}
        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-text-primary">{getLeagueTitle()}</h3>
              {!hasSeasonPass && (
                <button
                  onClick={handleSeasonPassClick}
                  className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md font-semibold hover:bg-primary/80 transition-colors"
                >
                  🎫 Season Pass
                </button>
              )}
              {hasSeasonPass && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-md font-semibold border border-green-500/30">
                  ✅ Season Member
                </span>
              )}
            </div>
          </div>
          
          {/* Prize Pool Section */}
          <div 
            onClick={() => setShowPrizePoolModal(true)}
            className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30 rounded-xl p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-xl group-hover:from-amber-500/10 group-hover:to-orange-500/10 transition-all duration-300"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🏆</div>
                <div>
                  <div className="text-xl font-bold text-text-primary mb-1">Total Prize Pool</div>
                  <div className="text-text-secondary text-sm">Click to view breakdown & rules</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-bold text-amber-400 mb-1">200,000</div>
                <div className="text-amber-300 font-semibold">SATS</div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="text-xs">
                  <div className="text-amber-300 font-semibold">1st</div>
                  <div className="text-text-secondary">30k</div>
                </div>
                <div className="text-xs">
                  <div className="text-gray-300 font-semibold">2nd</div>
                  <div className="text-text-secondary">20k</div>
                </div>
                <div className="text-xs">
                  <div className="text-orange-300 font-semibold">3rd</div>
                  <div className="text-text-secondary">15k</div>
                </div>
                <div className="text-xs">
                  <div className="text-blue-300 font-semibold">Hon.</div>
                  <div className="text-text-secondary">5k</div>
                </div>
              </div>
              <div className="text-xs text-text-muted text-center mt-2">Per activity mode (Running, Walking, Cycling)</div>
            </div>
            
            <div className="absolute top-4 right-4 text-text-muted group-hover:text-text-secondary transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Empty state message */}
        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
          <div className="flex flex-col justify-center items-center h-32">
            <div className="text-4xl mb-3">
              {leagueState.type === 'empty-participants' ? '🎫' : 
               leagueState.type === 'pre-competition' ? '⏰' : '🏃‍♂️'}
            </div>
            <p className="text-text-secondary text-center">{leagueState.message}</p>
            {leagueState.type === 'empty-participants' && !hasSeasonPass && (
              <button
                onClick={handleSeasonPassClick}
                className="mt-4 px-4 py-2 bg-primary text-text-primary rounded-md font-semibold hover:bg-primary/80 transition-colors"
              >
                Get Season Pass
              </button>
            )}
          </div>
        </div>

        {/* Season Pass Payment Modal */}
        <SeasonPassPaymentModal
          open={showSeasonPassModal}
          onClose={() => setShowSeasonPassModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Prize Pool Modal */}
        <PrizePoolModal
          open={showPrizePoolModal}
          onClose={() => setShowPrizePoolModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Prize Pool Display */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-text-primary">{getLeagueTitle()}</h3>
            {!hasSeasonPass && (
              <button
                onClick={handleSeasonPassClick}
                className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md font-semibold hover:bg-primary/80 transition-colors"
              >
                🎫 Season Pass
              </button>
            )}
            {hasSeasonPass && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-md font-semibold border border-green-500/30">
                ✅ Season Member
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary">
            {lastUpdated && `Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
          </div>
        </div>
        
        {/* Prize Pool Section */}
        <div 
          onClick={() => setShowPrizePoolModal(true)}
          className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30 rounded-xl p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all duration-300 group"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-xl group-hover:from-amber-500/10 group-hover:to-orange-500/10 transition-all duration-300"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div>
                <div className="text-xl font-bold text-text-primary mb-1">Total Prize Pool</div>
                <div className="text-text-secondary text-sm">Click to view breakdown & rules</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-400 mb-1">200,000</div>
              <div className="text-amber-300 font-semibold">SATS</div>
            </div>
          </div>
          
          {/* Prize distribution preview */}
          <div className="mt-4 pt-4 border-t border-amber-500/20">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="text-xs">
                <div className="text-amber-300 font-semibold">1st</div>
                <div className="text-text-secondary">30k</div>
              </div>
              <div className="text-xs">
                <div className="text-gray-300 font-semibold">2nd</div>
                <div className="text-text-secondary">20k</div>
              </div>
              <div className="text-xs">
                <div className="text-orange-300 font-semibold">3rd</div>
                <div className="text-text-secondary">15k</div>
              </div>
              <div className="text-xs">
                <div className="text-blue-300 font-semibold">Hon.</div>
                <div className="text-text-secondary">5k</div>
              </div>
            </div>
            <div className="text-xs text-text-muted text-center mt-2">Per activity mode (Running, Walking, Cycling)</div>
          </div>
          
          {/* Click indicator */}
          <div className="absolute top-4 right-4 text-text-muted group-hover:text-text-secondary transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
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
                    Rank #{user.rank}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Season Pass Payment Modal */}
      <SeasonPassPaymentModal
        open={showSeasonPassModal}
        onClose={() => setShowSeasonPassModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Prize Pool Modal */}
      <PrizePoolModal
        open={showPrizePoolModal}
        onClose={() => setShowPrizePoolModal(false)}
      />
    </div>
  );
};
