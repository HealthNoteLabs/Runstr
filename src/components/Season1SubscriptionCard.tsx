import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSeasonSubscription } from '../hooks/useSeasonSubscription';
import { REWARDS } from '../config/rewardsConfig';

interface Season1SubscriptionCardProps {
  className?: string;
}

export const Season1SubscriptionCard: React.FC<Season1SubscriptionCardProps> = ({ 
  className = '' 
}) => {
  const { currentUser } = useAuth();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState<string | null>(null);
  
  const subscription = useSeasonSubscription(currentUser?.pubkey || null);

  const handleSubscribe = async (tier: 'member' | 'captain') => {
    if (!currentUser?.pubkey) {
      setSubscriptionError('Please connect your Nostr account first');
      return;
    }

    setIsSubscribing(true);
    setSubscriptionError(null);
    setSubscriptionSuccess(null);

    try {
      await subscription.subscribe(tier);
      setSubscriptionSuccess('Successfully subscribed as Season 1 ' + tier + '!');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSubscriptionSuccess(null), 5000);
    } catch (error) {
      console.error('Subscription failed:', error);
      setSubscriptionError(error instanceof Error ? error.message : 'Subscription failed');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Helper to format dates
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Helper to format sats
  const formatSats = (sats: number) => {
    return sats.toLocaleString();
  };

  // If user is already subscribed, show status
  if (subscription.phase === 'current') {
    return (
      <div className={'season1-subscription-card active ' + className}>
        <div className="subscription-header">
          <div className="subscription-badge">
            {subscription.tier === 'captain' ? '' : ''} Season 1 {subscription.tier}
          </div>
          <div className="subscription-status"> Active</div>
        </div>
        <div className="subscription-details">
          <p>You're participating in RUNSTR Season 1!</p>
          {subscription.nextDue && (
            <p className="expiry-date">
              Valid until: {formatDate(subscription.nextDue)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: Show subscription options
  return (
    <div className={'season1-subscription-card ' + className}>
      <div className="subscription-header">
        <h3> Join Season 1 Competition</h3>
        <div className="season-dates">
          {new Date(REWARDS.SEASON_1.startDate).toLocaleDateString()} - {new Date(REWARDS.SEASON_1.endDate).toLocaleDateString()}
        </div>
      </div>
      
      <div className="subscription-description">
        <p>
          Compete for Bitcoin prizes in the first-ever RUNSTR Season! 
          Only subscribers can participate in the official competition.
        </p>
      </div>

      <div className="subscription-tiers">
        <div className="tier member-tier">
          <div className="tier-header">
            <h4> Member</h4>
            <div className="price">{formatSats(REWARDS.SEASON_1.memberFee)} sats</div>
          </div>
          <ul className="tier-benefits">
            <li>Participate in Season 1 distance competition</li>
            <li>Access to subscriber-only leaderboards</li>
            <li>Eligible for prize pool distribution</li>
          </ul>
          <button 
            className="subscribe-btn member"
            onClick={() => handleSubscribe('member')}
            disabled={isSubscribing || subscription.isProcessing}
          >
            {isSubscribing ? 'Processing...' : 'Subscribe as Member'}
          </button>
        </div>

        <div className="tier captain-tier">
          <div className="tier-header">
            <h4> Captain</h4>
            <div className="price">{formatSats(REWARDS.SEASON_1.captainFee)} sats</div>
          </div>
          <ul className="tier-benefits">
            <li>All Member benefits</li>
            <li>Captain badge on your runs</li>
            <li>Higher prize pool allocation</li>
            <li>Support RUNSTR development</li>
          </ul>
          <button 
            className="subscribe-btn captain"
            onClick={() => handleSubscribe('captain')}
            disabled={isSubscribing || subscription.isProcessing}
          >
            {isSubscribing ? 'Processing...' : 'Subscribe as Captain'}
          </button>
        </div>
      </div>

      <div className="prize-pool-info">
        <div className="prize-pool-header"> Prize Pool</div>
        <div className="prizes">
          <div className="prize"> {formatSats(REWARDS.SEASON_1.prizePool.first)} sats</div>
          <div className="prize"> {formatSats(REWARDS.SEASON_1.prizePool.second)} sats</div>
          <div className="prize"> {formatSats(REWARDS.SEASON_1.prizePool.third)} sats</div>
        </div>
      </div>

      {subscriptionError && (
        <div className="subscription-error">
           {subscriptionError}
        </div>
      )}

      {subscriptionSuccess && (
        <div className="subscription-success">
           {subscriptionSuccess}
        </div>
      )}
    </div>
  );
};