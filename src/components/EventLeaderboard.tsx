import React, { useState, useEffect } from 'react';
import { useNostr } from '../hooks/useNostr';
import { TeamEventDetails } from '../services/nostr/NostrTeamsService';
import { EventsService } from '../services/EventsService';
import NDK, { NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';

interface WorkoutResult {
  pubkey: string;
  distance: number;
  duration: number;
  activityType: string;
  calories?: number;
  elevation?: number;
  created_at: number;
  eventId: string;
  eventName: string;
}

interface LeaderboardEntry {
  pubkey: string;
  totalDistance: number;
  totalDuration: number;
  workoutCount: number;
  bestTime?: number;
  averagePace?: number;
  rank: number;
  workouts: WorkoutResult[];
}

interface EventLeaderboardProps {
  event: TeamEventDetails;
  className?: string;
}

const EventLeaderboard: React.FC<EventLeaderboardProps> = ({ event, className = '' }) => {
  const { ndk, ndkReady } = useNostr();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!ndk || !ndkReady || !event) {
        setIsLoading(false);
        return;
      }

      try {
        console.log(`[EventLeaderboard] Loading leaderboard for event ${event.id}`);
        setError(null);
        
        const eventWorkouts = await fetchEventWorkouts(ndk, event);
        setWorkouts(eventWorkouts);
        
        const leaderboardData = calculateLeaderboard(eventWorkouts);
        setLeaderboard(leaderboardData);
        
        console.log(`[EventLeaderboard] Loaded ${eventWorkouts.length} workouts, ${leaderboardData.length} participants`);
      } catch (err) {
        console.error('[EventLeaderboard] Error loading leaderboard:', err);
        setError('Failed to load leaderboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [ndk, ndkReady, event]);

  // Fetch workout notes (Kind 1301) with event tags from the event timeframe
  const fetchEventWorkouts = async (ndk: NDK, event: TeamEventDetails): Promise<WorkoutResult[]> => {
    // Use UTC dates to match workout timestamps (which are in UTC)
    const eventStartTime = new Date(event.date + 'T00:00:00Z').getTime() / 1000;
    const eventEndTime = event.endTime 
      ? new Date(`${event.date}T${event.endTime}:00Z`).getTime() / 1000
      : new Date(event.date + 'T23:59:59Z').getTime() / 1000;

    const filter: NDKFilter = {
      kinds: [1301 as NDKKind], // Workout events
      '#event': [event.id], // Events tagged with this event ID
      since: Math.floor(eventStartTime),
      until: Math.floor(eventEndTime),
      limit: 500
    };

    console.log(`[EventLeaderboard] Querying workouts from ${new Date(eventStartTime * 1000)} to ${new Date(eventEndTime * 1000)}`);
    
    const events = await ndk.fetchEvents(filter);
    
    if (!events || events.size === 0) {
      console.log('[EventLeaderboard] No workout events found');
      return [];
    }

    const workouts: WorkoutResult[] = [];
    
    for (const rawEvent of Array.from(events)) {
      try {
        const workout = parseWorkoutEvent(rawEvent, event.id);
        if (workout) {
          workouts.push(workout);
        }
      } catch (parseError) {
        console.warn('[EventLeaderboard] Failed to parse workout:', rawEvent.id, parseError);
      }
    }

    return workouts.sort((a, b) => b.created_at - a.created_at);
  };

  // Parse a Kind 1301 workout event into WorkoutResult
  const parseWorkoutEvent = (rawEvent: any, eventId: string): WorkoutResult | null => {
    try {
      const getTag = (tagName: string): string | null => {
        const tag = rawEvent.tags?.find((t: any[]) => t[0] === tagName);
        return tag?.[1] || null;
      };

      const distance = parseFloat(getTag('distance') || '0');
      const durationStr = getTag('duration') || '00:00:00';
      const activityType = getTag('exercise') || 'run';
      
      // Parse duration (HH:MM:SS format)
      const durationParts = durationStr.split(':');
      const duration = durationParts.length === 3 
        ? parseInt(durationParts[0]) * 3600 + parseInt(durationParts[1]) * 60 + parseInt(durationParts[2])
        : 0;

      // Get event info from tags
      const eventTag = rawEvent.tags?.find((t: any[]) => t[0] === 'event' && t[1] === eventId);
      const eventName = eventTag?.[2] || 'Unknown Event';

      if (distance <= 0 || duration <= 0) {
        console.warn('[EventLeaderboard] Invalid workout data:', { distance, duration });
        return null;
      }

      return {
        pubkey: rawEvent.pubkey,
        distance,
        duration,
        activityType,
        calories: parseInt(getTag('calories') || '0') || undefined,
        elevation: parseFloat(getTag('elevation_gain') || '0') || undefined,
        created_at: rawEvent.created_at,
        eventId,
        eventName
      };
    } catch (error) {
      console.error('[EventLeaderboard] Error parsing workout event:', error);
      return null;
    }
  };

  // Calculate leaderboard from workout results
  const calculateLeaderboard = (workouts: WorkoutResult[]): LeaderboardEntry[] => {
    const participantMap = new Map<string, LeaderboardEntry>();

    workouts.forEach(workout => {
      const { pubkey } = workout;
      
      if (!participantMap.has(pubkey)) {
        participantMap.set(pubkey, {
          pubkey,
          totalDistance: 0,
          totalDuration: 0,
          workoutCount: 0,
          rank: 0,
          workouts: []
        });
      }

      const entry = participantMap.get(pubkey)!;
      entry.totalDistance += workout.distance;
      entry.totalDuration += workout.duration;
      entry.workoutCount += 1;
      entry.workouts.push(workout);
      
      // Update best time (fastest workout)
      if (!entry.bestTime || workout.duration < entry.bestTime) {
        entry.bestTime = workout.duration;
      }
    });

    // Calculate average pace and sort by total distance
    const leaderboardArray = Array.from(participantMap.values()).map(entry => {
      if (entry.totalDistance > 0 && entry.totalDuration > 0) {
        entry.averagePace = entry.totalDuration / 60 / entry.totalDistance; // minutes per distance unit
      }
      return entry;
    });

    // Sort by total distance (descending), then by workout count (descending)
    leaderboardArray.sort((a, b) => {
      if (b.totalDistance !== a.totalDistance) {
        return b.totalDistance - a.totalDistance;
      }
      return b.workoutCount - a.workoutCount;
    });

    // Assign ranks
    leaderboardArray.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboardArray;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number): string => {
    if (!pace || pace <= 0) return '-';
    const minutes = Math.floor(pace);
    const seconds = Math.floor((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const shortenPubkey = (pubkey: string): string => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className={`bg-bg-secondary rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Event Leaderboard</h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-bg-secondary rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Event Leaderboard</h3>
        <div className="text-center py-8">
          <div className="text-error text-2xl mb-2">⚠️</div>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-bg-secondary rounded-lg p-6 border border-border-secondary ${className}`}>
      <h3 className="text-lg font-semibold text-text-primary mb-4">Event Leaderboard</h3>
      
      {leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🏃‍♂️</div>
          <h4 className="text-lg font-semibold text-text-primary mb-2">No Results Yet</h4>
          <p className="text-text-secondary">
            Be the first to complete a workout for this event!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="bg-bg-tertiary rounded-lg p-4 border border-border-secondary mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-text-primary">{leaderboard.length}</div>
                <div className="text-sm text-text-secondary">Participants</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{workouts.length}</div>
                <div className="text-sm text-text-secondary">Total Workouts</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">
                  {leaderboard.reduce((sum, entry) => sum + entry.totalDistance, 0).toFixed(1)}km
                </div>
                <div className="text-sm text-text-secondary">Total Distance</div>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          {leaderboard.map((entry, index) => (
            <div
              key={entry.pubkey}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                index === 0 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : index === 1 
                  ? 'bg-gray-50 border-gray-200'
                  : index === 2
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-bg-tertiary border-border-secondary'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`text-lg font-bold ${
                  index === 0 ? 'text-yellow-600' : 
                  index === 1 ? 'text-gray-600' :
                  index === 2 ? 'text-orange-600' : 'text-text-primary'
                }`}>
                  #{entry.rank}
                  {index === 0 && ' 🥇'}
                  {index === 1 && ' 🥈'}
                  {index === 2 && ' 🥉'}
                </div>
                <div>
                  <div className="font-medium text-text-primary">
                    {shortenPubkey(entry.pubkey)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {entry.workoutCount} workout{entry.workoutCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-text-primary">
                  {entry.totalDistance.toFixed(2)}km
                </div>
                <div className="text-sm text-text-secondary">
                  {formatDuration(entry.totalDuration)}
                  {entry.averagePace && (
                    <span className="ml-2">
                      ({formatPace(entry.averagePace)}/km)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventLeaderboard;