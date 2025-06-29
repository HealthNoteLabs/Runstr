import { useState, useEffect, useCallback } from 'react';
import { useRunFeed } from './useRunFeed';
import { useNostr } from './useNostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { season1SubscriptionService } from '../services/season1SubscriptionService';

interface LeagueRunFeedResult {
  // All posts from RUNSTR feed
  allPosts: any[];
  // Only posts from Season 1 subscribers
  participantPosts: any[];
  // Set of current subscriber pubkeys for quick lookup
  subscribers: Set<string>;
  // Set of captain pubkeys
  captains: Set<string>;
  // Other properties from useRunFeed
  loading: boolean;
  error: string | null;
  userLikes: Set<string>;
  setUserLikes: (likes: Set<string>) => void;
  userReposts: Set<string>;
  setUserReposts: (reposts: Set<string>) => void;
  loadSupplementaryData: any;
  loadMorePosts: () => void;
  fetchRunPostsViaSubscription: () => Promise<void>;
  loadedSupplementaryData: Set<string>;
  clearCacheAndRefresh: () => void;
  // League-specific controls
  showParticipantsOnly: boolean;
  setShowParticipantsOnly: (value: boolean) => void;
  // Subscription loading state
  subscriptionsLoading: boolean;
}

/**
 * Hook that extends useRunFeed with Season 1 subscription filtering.
 * Provides both full RUNSTR feed and filtered participant-only feed.
 */
export function useLeagueRunFeed(): LeagueRunFeedResult {
  const { ndk } = useNostr() as any;
  const { mode: activityMode } = useActivityMode();
  const [subscribers, setSubscribers] = useState<Set<string>>(new Set());
  const [captains, setCaptains] = useState<Set<string>>(new Set());
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [showParticipantsOnly, setShowParticipantsOnly] = useState(true);
  
  // Use the existing RUNSTR feed
  const runFeed = useRunFeed('RUNSTR');

  // Load Season 1 subscribers on mount and periodically
  const loadSubscribers = useCallback(async () => {
    if (!ndk) return;
    
    setSubscriptionsLoading(true);
    try {
      console.log('[LeagueRunFeed] Loading Season 1 subscribers...');
      
      // Load both regular subscribers and captains
      const [subscriberPubkeys, captainPubkeys] = await Promise.all([
        season1SubscriptionService.getSubscriberPubkeys(ndk),
        season1SubscriptionService.getCaptainPubkeys(ndk)
      ]);
      
      setSubscribers(subscriberPubkeys);
      setCaptains(captainPubkeys);
      
      console.log('[LeagueRunFeed] Loaded ' + subscriberPubkeys.size + ' subscribers, ' + captainPubkeys.size + ' captains');
    } catch (error) {
      console.error('[LeagueRunFeed] Error loading subscribers:', error);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [ndk]);

  // Load subscribers on mount and when NDK is ready
  useEffect(() => {
    if (ndk) {
      loadSubscribers();
      
      // Refresh subscriber list every 5 minutes
      const interval = setInterval(loadSubscribers, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [ndk, loadSubscribers]);

  // Filter posts by Season 1 subscription tags AND activity mode
  const participantPosts = useCallback(() => {
    if (!runFeed.posts) {
      return [];
    }
    
    return runFeed.posts.filter(post => {
      // First filter: Only include posts with Season 1 subscription tags
      const seasonTag = post.tags?.find(tag => tag[0] === 'season' && tag[1] === 'runstr-season-1-2025');
      if (!seasonTag) {
        return false;
      }
      
      // Second filter: Apply activity mode filtering (same logic as useRunFeed.js)
      if (activityMode) {
        const exerciseTag = post.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        // More lenient activity matching - include variations (same as useRunFeed.js)
        const activityMatches = {
          'run': ['run', 'running', 'jog', 'jogging'],     
          'cycle': ['cycle', 'cycling', 'bike', 'biking'], 
          'walk': ['walk', 'walking', 'hike', 'hiking']    
        };
        
        const acceptedActivities = activityMatches[activityMode] || [activityMode];
        
        // Skip events that don't match current activity mode
        if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
          console.log(`[LeagueRunFeed] Filtering out ${eventActivityType} activity (mode: ${activityMode})`);
          return false;
        }
        
        // If no exercise tag but is RUNSTR workout, allow it through (fallback)
        if (!eventActivityType) {
          console.log(`[LeagueRunFeed] RUNSTR workout with no exercise tag - allowing through`);
        }
      }
      
      console.log(`[LeagueRunFeed] Including Season 1 participant post from ${post.pubkey.slice(0, 8)}`);
      return true;
    });
  }, [runFeed.posts, activityMode]);

  // Get the current posts to display
  const getCurrentPosts = useCallback(() => {
    return showParticipantsOnly ? participantPosts() : runFeed.posts;
  }, [showParticipantsOnly, participantPosts, runFeed.posts]);

  // Force refresh of both feed and subscriptions
  const clearCacheAndRefresh = useCallback(() => {
    // Clear subscription cache
    season1SubscriptionService.clearCache();
    // Reload subscribers
    loadSubscribers();
    // Clear run feed cache
    runFeed.clearCacheAndRefresh();
  }, [loadSubscribers, runFeed]);

  return {
    allPosts: runFeed.posts,
    participantPosts: participantPosts(),
    subscribers,
    captains,
    loading: runFeed.loading,
    error: runFeed.error,
    userLikes: runFeed.userLikes,
    setUserLikes: runFeed.setUserLikes,
    userReposts: runFeed.userReposts,
    setUserReposts: runFeed.setUserReposts,
    loadSupplementaryData: runFeed.loadSupplementaryData,
    loadMorePosts: runFeed.loadMorePosts,
    fetchRunPostsViaSubscription: runFeed.fetchRunPostsViaSubscription,
    loadedSupplementaryData: runFeed.loadedSupplementaryData,
    clearCacheAndRefresh,
    showParticipantsOnly,
    setShowParticipantsOnly,
    subscriptionsLoading
  };
}

/**
 * Hook to check if a specific user is a Season 1 participant
 */
export function useIsSeasonParticipant(pubkey: string | null): {
  isSubscriber: boolean;
  isCaptain: boolean;
  loading: boolean;
} {
  const { subscribers, captains, subscriptionsLoading } = useLeagueRunFeed();
  
  return {
    isSubscriber: pubkey ? subscribers.has(pubkey) : false,
    isCaptain: pubkey ? captains.has(pubkey) : false,
    loading: subscriptionsLoading
  };
}
