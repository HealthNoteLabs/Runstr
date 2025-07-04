import { useState, useEffect, useMemo } from 'react';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';
import SeasonPassPaymentModal from './modals/SeasonPassPaymentModal';
import PrizePoolModal from './modals/PrizePoolModal';
import seasonPassPaymentService from '../services/seasonPassPaymentService';
import seasonPassService from '../services/seasonPassService';

export const LeagueMap = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  console.log('🔍 LeagueMap: Restored component rendering');
  
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
      const profile = profiles?.[user.pubkey] || {};
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
    if (!activityMode) return 'RUNSTR SEASON 1';
    
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
    refreshLeaderboard();
  };

  // Simple loading state check
  if (isInitialLoad || leaderboardLoading) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <div className="flex space-x-1 mb-3">
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-75"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-150"></span>
          </div>
          <p className="text-text-secondary">Loading League Race...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (leaderboardError) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <p className="text-red-400 text-sm mb-2">Error: {leaderboardError}</p>
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

  return (
    <div className="space-y-4 mb-4">
      {/* Season Pass Section */}
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
        
        {/* Simple Prize Pool Display */}
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

      {/* Simple Leaderboard */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-bg-tertiary">
          <h3 className="text-lg font-semibold text-text-primary">🏆 League Standings</h3>
        </div>
        
        {enhancedLeaderboard.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-text-secondary">No participants with runs yet. Purchase Season Pass to join!</p>
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {enhancedLeaderboard.slice(0, 10).map((user) => (
              <div key={user.pubkey} className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-bg-tertiary text-text-secondary border border-border-secondary">
                    {user.rank}
                  </div>
                  <div>
                    <span className="font-medium text-text-primary">
                      {user.displayName}
                    </span>
                    {user.isCurrentUser && (
                      <span className="ml-2 px-2 py-1 bg-primary text-text-primary text-xs rounded-full font-bold">
                        YOU
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-text-primary">
                    {user.totalMiles.toFixed(1)} mi
                  </div>
                  <div className="text-xs text-text-secondary">
                    {user.runCount} runs
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