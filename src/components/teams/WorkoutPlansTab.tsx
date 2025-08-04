import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { fetchWorkoutPlans, WorkoutPlanDetails } from '../../services/nostr/NostrTeamsService';
import { 
  CACHE_KEYS, 
  CACHE_TTL, 
  loadCachedData, 
  saveCachedData, 
  clearCachedData 
} from '../../utils/teamEventsCache.js';
import CreateWorkoutPlanModal from '../modals/CreateWorkoutPlanModal';
import toast from 'react-hot-toast';

/**
 * Utility function for exponential backoff retry logic
 */
const withExponentialBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay: 1s, 2s, 4s, 8s...
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[withExponentialBackoff] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

interface WorkoutPlansTabProps {
  captainPubkey: string;
  teamUUID: string;
  isCaptain: boolean;
}

const WorkoutPlansTab: React.FC<WorkoutPlansTabProps> = ({ 
  captainPubkey, 
  teamUUID, 
  isCaptain 
}) => {
  const { ndk, ndkReady } = useNostr();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlanDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  
  // Enhanced loading states following League's progressive loading pattern
  const [loadingProgress, setLoadingProgress] = useState({
    phase: 'initializing',
    message: 'Loading workout plans...',
    fromCache: false
  });

  /**
   * Load cached data immediately - League's cache-first pattern
   */
  const loadCachedPlans = useCallback(() => {
    if (!captainPubkey || !teamUUID) return false;
    
    try {
      const cacheKey = CACHE_KEYS.WORKOUT_PLANS(captainPubkey, teamUUID);
      if (!cacheKey) return false;
      
      const cached = loadCachedData(cacheKey, CACHE_TTL.WORKOUT_PLANS);
      
      if (cached) {
        setWorkoutPlans(cached.data);
        setLastUpdated(cached.timestamp);
        setLoadingProgress({
          phase: 'complete',
          message: 'Using cached workout plans',
          fromCache: true
        });
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error('Error loading cached workout plans:', err);
    }
    return false;
  }, [captainPubkey, teamUUID]);

  /**
   * Fetch fresh workout plans data - League's background refresh pattern
   * Memoized to prevent excessive re-renders, with exponential backoff for resilience
   */
  const fetchPlansData = useCallback(async () => {
    if (!ndk || !captainPubkey || !teamUUID) {
      setError('Nostr connection not available');
      return;
    }

    try {
      setError(null);
      setLoadingProgress({
        phase: 'fetching',
        message: 'Fetching latest workout plans...',
        fromCache: false
      });

      // Use exponential backoff for network resilience
      const plans = await withExponentialBackoff(
        () => fetchWorkoutPlans(ndk, captainPubkey, teamUUID),
        3, // max retries
        1000 // initial delay (1 second)
      );
      
      // Cache the results
      const cacheKey = CACHE_KEYS.WORKOUT_PLANS(captainPubkey, teamUUID);
      if (cacheKey) {
        saveCachedData(cacheKey, plans);
      }
      
      setWorkoutPlans(plans);
      setLastUpdated(new Date());
      setLoadingProgress({
        phase: 'complete',
        message: 'Workout plans loaded successfully',
        fromCache: false
      });

    } catch (err) {
      console.error('Error fetching workout plans (after retries):', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workout plans';
      setError(errorMessage);
      
      // Show toast only if we don't have cached data to fall back to
      if (workoutPlans.length === 0) {
        toast.error('Connection issues - using cached data if available');
      }
      
      setLoadingProgress({
        phase: 'complete',
        message: 'Network error - check connection',
        fromCache: false
      });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, captainPubkey, teamUUID]); // Removed workoutPlans.length dependency to prevent cascading re-renders

  /**
   * Refresh workout plans data with cache clearing
   */
  const refreshPlans = useCallback(async () => {
    if (!captainPubkey || !teamUUID) return;
    
    setIsLoading(true);
    setLoadingProgress({
      phase: 'initializing',
      message: 'Refreshing workout plans...',
      fromCache: false
    });
    
    // Clear cache to force fresh fetch
    const cacheKey = CACHE_KEYS.WORKOUT_PLANS(captainPubkey, teamUUID);
    if (cacheKey) {
      clearCachedData(cacheKey);
    }
    
    await fetchPlansData();
  }, [captainPubkey, teamUUID, fetchPlansData]);

  // Load cached data immediately on mount - League's cache-first pattern
  useEffect(() => {
    const hasCachedData = loadCachedPlans();
    if (!hasCachedData) {
      fetchPlansData();
    }
  }, [loadCachedPlans, fetchPlansData]);

  // Fetch fresh data when NDK becomes ready (only if no cached data was loaded)
  useEffect(() => {
    if (ndk && ndkReady && workoutPlans.length === 0 && !isLoading && !loadingProgress.fromCache) {
      console.log('[WorkoutPlansTab] NDK ready, fetching fresh data (no cached data available)');
      fetchPlansData();
    }
  }, [ndk, ndkReady, workoutPlans.length, isLoading, loadingProgress.fromCache, fetchPlansData]);

  // Auto-refresh every 15 minutes with staggered timing to reduce server load
  useEffect(() => {
    const baseRefreshInterval = 15 * 60 * 1000; // 15 minutes
    // Add random jitter (0-2 minutes) to stagger refreshes across users
    const jitter = Math.random() * 2 * 60 * 1000; // 0-2 minutes
    const refreshInterval = baseRefreshInterval + jitter;
    
    const interval = setInterval(() => {
      console.log('[WorkoutPlansTab] Auto-refreshing workout plans');
      fetchPlansData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPlansData]);

  const handlePlanCreated = () => {
    setShowCreateModal(false);
    // Clear cache and reload plans after creation using new refresh method
    refreshPlans();
  };

  const togglePlanExpansion = (planId: string) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  const getDifficultyBadge = (difficulty: string) => {
    const badgeClasses = {
      beginner: 'bg-green-500 text-white',
      intermediate: 'bg-yellow-500 text-black',
      advanced: 'bg-red-500 text-white'
    };
    
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded ${badgeClasses[difficulty] || badgeClasses.beginner}`}>
        {difficulty.toUpperCase()}
      </span>
    );
  };

  const renderExerciseList = (exercises: any[]) => {
    if (!exercises || exercises.length === 0) {
      return <p className="text-text-muted text-sm">No exercises defined</p>;
    }

    return (
      <div className="space-y-2">
        {exercises.map((exercise, index) => (
          <div key={index} className="border border-gray-700 rounded p-3 bg-gray-900">
            <div className="flex justify-between items-start mb-2">
              <h5 className="font-medium text-text-primary">{exercise.name}</h5>
              <span className="text-xs font-medium text-black bg-white px-2 py-1 rounded">
                {exercise.type?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
              {exercise.duration && (
                <div>Duration: {exercise.duration}</div>
              )}
              {exercise.distance && (
                <div>Distance: {exercise.distance}</div>
              )}
              {exercise.intensity && (
                <div>Intensity: {exercise.intensity}</div>
              )}
              {exercise.sets && (
                <div>Sets: {exercise.sets}</div>
              )}
              {exercise.reps && (
                <div>Reps: {exercise.reps}</div>
              )}
            </div>
            {exercise.notes && (
              <p className="text-xs text-text-muted mt-2">{exercise.notes}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading && workoutPlans.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted">{loadingProgress.message}</p>
        {loadingProgress.phase === 'fetching' && (
          <div className="mt-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status indicator for cached data or background loading */}
      {(loadingProgress.fromCache || error) && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm">
          <div className="flex items-center gap-2">
            {loadingProgress.fromCache && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-yellow-400">Using cached data</span>
                {lastUpdated && (
                  <span className="text-text-muted">
                    • Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </>
            )}
            {error && !loadingProgress.fromCache && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-400">Network error</span>
              </>
            )}
          </div>
          {isLoading && workoutPlans.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
              <span className="text-text-muted text-xs">Refreshing...</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-text-primary">Workout Plans</h3>
        {isCaptain && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors border-2 border-white focus:outline-none focus:ring-0"
          >
            Create Plan
          </button>
        )}
      </div>

      {workoutPlans.length === 0 ? (
        <div className="text-center py-12 bg-black rounded-lg border border-white">
          <p className="text-text-muted mb-2">No workout plans created yet.</p>
          {isCaptain && (
            <p className="text-sm text-text-muted">Create your first workout plan to get started!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {workoutPlans.map((plan, index) => (
            <div
              key={plan.id || `plan-${index}`}
              className="bg-black border border-white rounded-lg p-4 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-3">
                  <div>
                    <h4 className="text-lg font-semibold text-text-primary">{plan.name}</h4>
                    {plan.description && (
                      <p className="text-sm text-text-secondary mt-1">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {getDifficultyBadge(plan.difficulty)}
                      {plan.duration && (
                        <span className="text-xs text-text-muted">
                          Duration: {plan.duration}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {plan.exercises?.length || 0} exercises
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-3">
                <p className="text-sm text-text-muted">
                  Created {new Date(plan.createdAt * 1000).toLocaleDateString()}
                </p>
                <button
                  onClick={() => togglePlanExpansion(plan.id)}
                  className="text-sm text-text-primary hover:text-white transition-colors"
                >
                  {expandedPlan === plan.id ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {expandedPlan === plan.id && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h5 className="font-medium text-text-primary mb-3">Exercises</h5>
                  {renderExerciseList(plan.exercises)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkoutPlanModal
          captainPubkey={captainPubkey}
          teamUUID={teamUUID}
          onClose={() => setShowCreateModal(false)}
          onPlanCreated={handlePlanCreated}
        />
      )}
    </div>
  );
};

export default WorkoutPlansTab;