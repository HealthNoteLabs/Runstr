import React from 'react';
import { useSubscriptionWalletBalance } from '../hooks/useSubscriptionWalletBalance';

/**
 * Displays all Season 1 related wallet balances: Prize Pool, Open Sats, App Development
 * Styled to match the minimalistic black and white design of LeagueMap
 */
export const RewardsPoolDisplay = () => {
  const { 
    prizePool,
    openSats, 
    appDev,
    isLoading,
    error,
    refresh 
  } = useSubscriptionWalletBalance();

  // Calculate prize distribution for the prize pool (50% first, 30% second, 20% third)
  const firstPlaceReward = Math.floor(prizePool.balance * 0.5);
  const secondPlaceReward = Math.floor(prizePool.balance * 0.3);
  const thirdPlaceReward = Math.floor(prizePool.balance * 0.2);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-text-primary">💰 Season 1 Funding</h3>
        <button 
          onClick={refresh}
          disabled={isLoading}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh balances"
        >
          {isLoading ? '🔄' : '↻'}
        </button>
      </div>

      {error ? (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-2">Error loading wallet balances</p>
          <button 
            onClick={refresh}
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md hover:bg-primary/80 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Three Wallet Balances Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Prize Pool */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-border-secondary">
              <div className="text-center">
                <div className="text-xs text-text-secondary mb-1">🏆 Prize Pool</div>
                <div className="text-lg font-bold text-text-primary">
                  {isLoading ? '...' : `${prizePool.balance.toLocaleString()}`}
                </div>
                <div className="text-xs text-text-secondary">sats</div>
                {prizePool.error && (
                  <div className="text-xs text-red-400 mt-1">Error</div>
                )}
              </div>
            </div>

            {/* Open Sats */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-border-secondary">
              <div className="text-center">
                <div className="text-xs text-text-secondary mb-1">🎯 Open Sats</div>
                <div className="text-lg font-bold text-text-primary">
                  {isLoading ? '...' : `${openSats.balance.toLocaleString()}`}
                </div>
                <div className="text-xs text-text-secondary">sats</div>
                {openSats.error && (
                  <div className="text-xs text-red-400 mt-1">Error</div>
                )}
              </div>
            </div>

            {/* App Development */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-border-secondary">
              <div className="text-center">
                <div className="text-xs text-text-secondary mb-1">⚡ App Dev</div>
                <div className="text-lg font-bold text-text-primary">
                  {isLoading ? '...' : `${appDev.balance.toLocaleString()}`}
                </div>
                <div className="text-xs text-text-secondary">sats</div>
                {appDev.error && (
                  <div className="text-xs text-red-400 mt-1">Error</div>
                )}
              </div>
            </div>
          </div>

          {/* Prize Distribution for Competition Winners */}
          {prizePool.balance > 0 && (
            <div className="border-t border-border-secondary pt-3">
              <div className="text-xs text-text-secondary mb-2 text-center">🏆 Competition Prize Distribution</div>
              <div className="grid grid-cols-3 gap-3">
                {/* First Place */}
                <div className="text-center">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-xs mx-auto mb-1">
                    1
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {firstPlaceReward.toLocaleString()}
                  </div>
                  <div className="text-xs text-text-secondary">sats</div>
                </div>

                {/* Second Place */}
                <div className="text-center">
                  <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-black font-bold text-xs mx-auto mb-1">
                    2
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {secondPlaceReward.toLocaleString()}
                  </div>
                  <div className="text-xs text-text-secondary">sats</div>
                </div>

                {/* Third Place */}
                <div className="text-center">
                  <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs mx-auto mb-1">
                    3
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {thirdPlaceReward.toLocaleString()}
                  </div>
                  <div className="text-xs text-text-secondary">sats</div>
                </div>
              </div>
            </div>
          )}

          {/* Growing Pool Indicator */}
          <div className="text-center pt-2 border-t border-border-secondary">
            <div className="text-xs text-text-secondary">
              💡 Balances update automatically as subscriptions are processed • Competition ends Oct 4, 2025
            </div>
          </div>

          {/* Empty State */}
          {prizePool.balance === 0 && openSats.balance === 0 && appDev.balance === 0 && !isLoading && (
            <div className="text-center py-2">
              <div className="text-sm text-text-secondary">
                Funding will grow as subscribers join Season 1
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 