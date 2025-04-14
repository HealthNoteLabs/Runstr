import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { initializeNostr, fetchEvents } from '../utils/nostrClient';

export const Events = () => {
  const { publicKey } = useContext(NostrContext);
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('streakLeaderboard'); // Default to streak leaderboard
  const [activeLeaderboard, setActiveLeaderboard] = useState('streak'); // 'streak', 'speed'
  const [activeDistanceCategory, setActiveDistanceCategory] = useState('5k'); // '1k', '5k', '10k'
  
  // Streak leaderboards by distance
  const [streakLeaderboard1k, setStreakLeaderboard1k] = useState([]);
  const [streakLeaderboard5k, setStreakLeaderboard5k] = useState([]);
  const [streakLeaderboard10k, setStreakLeaderboard10k] = useState([]);
  
  // Speed leaderboards by distance
  const [speedLeaderboard1k, setSpeedLeaderboard1k] = useState([]);
  const [speedLeaderboard5k, setSpeedLeaderboard5k] = useState([]);
  const [speedLeaderboard10k, setSpeedLeaderboard10k] = useState([]);
  
  // Profiles for actual Nostr users
  const [profiles, setProfiles] = useState(new Map());
  
  // Get the current active streak leaderboard based on distance category
  const currentStreakLeaderboard = useMemo(() => {
    switch(activeDistanceCategory) {
      case '1k': return streakLeaderboard1k;
      case '5k': return streakLeaderboard5k;
      case '10k': return streakLeaderboard10k;
      default: return streakLeaderboard5k;
    }
  }, [activeDistanceCategory, streakLeaderboard1k, streakLeaderboard5k, streakLeaderboard10k]);
  
  // Get the current active speed leaderboard based on distance category
  const currentSpeedLeaderboard = useMemo(() => {
    switch(activeDistanceCategory) {
      case '1k': return speedLeaderboard1k;
      case '5k': return speedLeaderboard5k;
      case '10k': return speedLeaderboard10k;
      default: return speedLeaderboard5k;
    }
  }, [activeDistanceCategory, speedLeaderboard1k, speedLeaderboard5k, speedLeaderboard10k]);
  
  // Format seconds to time string (HH:MM:SS)
  const formatSecondsToTime = useCallback((totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  }, []);
  
  // Calculate pace (minutes per km or mile)
  const calculatePace = useCallback((timeInSeconds, distanceInKm) => {
    if (!timeInSeconds || !distanceInKm || distanceInKm === 0) return "00:00";
    
    const paceInSeconds = timeInSeconds / distanceInKm;
    const paceMinutes = Math.floor(paceInSeconds / 60);
    const paceSeconds = Math.floor(paceInSeconds % 60);
    
    return `${paceMinutes.toString().padStart(2, '0')}:${paceSeconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Get profile data for a specific npub
  const fetchProfileInfo = async (npub) => {
    if (!npub) return null;
    
    try {
      // Check if we already have this profile
      if (profiles.has(npub)) {
        return profiles.get(npub);
      }
      
      // Ensure Nostr is initialized
      if (!publicKey) {
        console.warn('Not logged in yet');
        return null;
      }
      
      const profileEvents = await fetchEvents({
        kinds: [0],
        authors: [npub],
        limit: 1
      });
      
      if (profileEvents.size === 0) {
        return null;
      }
      
      // Get the first profile event
      const event = Array.from(profileEvents)[0];
      let profile = { name: 'Unknown runner' };
      
      try {
        profile = JSON.parse(event.content);
      } catch {
        // Error parsing profile, use default
      }
      
      // Update profiles cache
      setProfiles(prev => new Map(prev).set(npub, profile));
      
      return profile;
    } catch (error) {
      console.error('Error fetching profile info:', error);
      return null;
    }
  };
  
  // Load user profiles
  const loadProfiles = useCallback(async (pubkeys) => {
    try {
      if (!pubkeys || !pubkeys.length) return;
      
      if (!publicKey) {
        console.warn('Not logged in yet');
        return;
      }
      
      const profileEvents = await fetchEvents({
        kinds: [0],
        authors: pubkeys
      });
      
      const newProfiles = new Map(profiles);
      
      profileEvents.forEach((event) => {
        try {
          const content = JSON.parse(event.content);
          newProfiles.set(event.pubkey, {
            ...content,
            name: content.name || content.display_name || event.pubkey.slice(0, 8) + '...'
          });
        } catch (err) {
          console.error('Error parsing profile:', err);
          newProfiles.set(event.pubkey, { 
            name: event.pubkey.slice(0, 8) + '...',
            picture: ''
          });
        }
      });
      
      setProfiles(newProfiles);
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }, [publicKey, profiles]);
  
  // Generate real-world streak data based only on this user's data
  const generateUserStreakData = useCallback(() => {
    const users = [];
    
    // Only include the current user if they exist
    if (publicKey) {
      const userProfile = profiles.get(publicKey) || {};
      const userName = userProfile.name || userProfile.display_name || 'You';
      const userPicture = userProfile.picture || '';
      
      // Get user's streak from localStorage if available
      let userStreak = 0;
      try {
        const storedStats = localStorage.getItem('runStats');
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          
          // Use the actual streak if available
          if (stats.currentStreak) {
            userStreak = stats.currentStreak;
          }
        }
      } catch (err) {
        console.error('Error parsing user stats:', err);
      }
      
      // Only add the user if they have a streak
      if (userStreak > 0) {
        users.push({
          pubkey: publicKey,
          name: userName,
          streak: userStreak,
          picture: userPicture,
          isCurrentUser: true
        });
      }
    }
    
    // Sort by streak (descending)
    const sortedUsers = users.sort((a, b) => b.streak - a.streak);
    
    // Add rank to each user
    return sortedUsers.map((user, index) => ({
      ...user,
      rank: index + 1
    }));
  }, [publicKey, profiles]);
  
  // Generate real-world speed data based only on this user's data
  const generateUserSpeedData = useCallback((distance) => {
    const distanceMap = {
      '1k': 1,
      '5k': 5,
      '10k': 10
    };
    
    const distanceKm = distanceMap[distance];
    const users = [];
    
    // Only include the current user if they exist
    if (publicKey) {
      const userProfile = profiles.get(publicKey) || {};
      const userName = userProfile.name || userProfile.display_name || 'You';
      const userPicture = userProfile.picture || '';
      
      // Try to get actual time from local storage if available
      let userTime = 0;
      let validRun = false;
      
      try {
        const storedRuns = localStorage.getItem('runHistory');
        if (storedRuns) {
          const runs = JSON.parse(storedRuns);
          
          // Find runs that match the distance category
          const matchingRuns = runs.filter(run => {
            const runDistanceKm = parseFloat(run.distance);
            
            // Match runs within 10% of the target distance
            if (distance === '1k') {
              return runDistanceKm >= 0.9 && runDistanceKm <= 1.1;
            } else if (distance === '5k') {
              return runDistanceKm >= 4.5 && runDistanceKm <= 5.5;
            } else if (distance === '10k') {
              return runDistanceKm >= 9 && runDistanceKm <= 11;
            }
            return false;
          });
          
          if (matchingRuns.length > 0) {
            validRun = true;
            
            // Find the fastest run
            const fastestRun = matchingRuns.reduce((fastest, current) => {
              // Parse time in format HH:MM:SS
              const [fHours, fMinutes, fSeconds] = fastest.time.split(':').map(Number);
              const [cHours, cMinutes, cSeconds] = current.time.split(':').map(Number);
              
              const fastestTotalSeconds = fHours * 3600 + fMinutes * 60 + fSeconds;
              const currentTotalSeconds = cHours * 3600 + cMinutes * 60 + cSeconds;
              
              return currentTotalSeconds < fastestTotalSeconds ? current : fastest;
            }, matchingRuns[0]);
            
            // Parse time to seconds
            const [hours, minutes, seconds] = fastestRun.time.split(':').map(Number);
            userTime = hours * 3600 + minutes * 60 + seconds;
          }
        }
      } catch (err) {
        console.error('Error parsing user run history:', err);
        validRun = false;
      }
      
      // Only add the user if they have a valid run for this distance
      if (validRun && userTime > 0) {
        users.push({
          pubkey: publicKey,
          name: userName,
          time: userTime,
          picture: userPicture,
          isCurrentUser: true,
          created_at: Math.floor(Date.now() / 1000)
        });
      }
    }
    
    // Sort by time (ascending - fastest first)
    const sortedUsers = users.sort((a, b) => a.time - b.time);
    
    // Add rank and formatted time/pace to each user
    return sortedUsers.map((user, index) => ({
      ...user,
      rank: index + 1,
      timeFormatted: formatSecondsToTime(user.time),
      pace: calculatePace(user.time, distanceKm)
    }));
  }, [publicKey, profiles, formatSecondsToTime, calculatePace]);
  
  // Load streak leaderboards for all distance categories
  const loadStreakLeaderboards = useCallback(async () => {
    try {
      // Load streak leaderboards for each distance category
      const streaks1k = generateUserStreakData();
      const streaks5k = generateUserStreakData();
      const streaks10k = generateUserStreakData();
      
      setStreakLeaderboard1k(streaks1k);
      setStreakLeaderboard5k(streaks5k);
      setStreakLeaderboard10k(streaks10k);
      
    } catch (err) {
      console.error('Error loading streak leaderboards:', err);
    }
  }, [generateUserStreakData]);
  
  // Load speed leaderboards for all distance categories
  const loadSpeedLeaderboards = useCallback(async () => {
    try {
      // Load speed leaderboards for each distance category
      const speeds1k = generateUserSpeedData('1k');
      const speeds5k = generateUserSpeedData('5k');
      const speeds10k = generateUserSpeedData('10k');
      
      setSpeedLeaderboard1k(speeds1k);
      setSpeedLeaderboard5k(speeds5k);
      setSpeedLeaderboard10k(speeds10k);
      
    } catch (err) {
      console.error('Error loading speed leaderboards:', err);
    }
  }, [generateUserSpeedData]);
  
  // Initialize connection and load data
  useEffect(() => {
    const setup = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to prevent hanging if connection fails
        try {
          await Promise.race([
            initializeNostr(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
          ]);
          
          // Load user profiles
          if (publicKey) {
            await loadProfiles([publicKey]);
          }
          
        } catch (err) {
          console.warn('Connection warning:', err.message);
          // Continue anyway - we'll use local storage as fallback
        }
        
        // Load leaderboards
        await Promise.all([
          loadStreakLeaderboards(),
          loadSpeedLeaderboards()
        ]);
        
        setLoading(false);
      } catch (err) {
        console.error('Error in setup:', err);
        setError('Failed to load competitions data. Please try again later.');
        setLoading(false);
      }
    };
    
    setup();
  }, [loadStreakLeaderboards, loadSpeedLeaderboards, loadProfiles, publicKey]);
  
  // Render streak leaderboard entry
  const renderStreakLeaderboardEntry = (entry) => {
    const isCurrentUser = entry.pubkey === publicKey || entry.isCurrentUser;
    
    return (
      <div key={entry.pubkey} className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}>
        <div className="rank">{entry.rank}</div>
        <div className="runner-info">
          {entry.picture && (
            <div className="runner-avatar">
              <img src={entry.picture} alt={entry.name} />
            </div>
          )}
          <div className="runner-name">
            {isCurrentUser ? `${entry.name} (You)` : entry.name}
          </div>
        </div>
        <div className="streak-info">
          <span className="streak-count">{entry.streak}</span>
          <span className="streak-label">{entry.streak === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    );
  };
  
  // Render speed leaderboard entry
  const renderSpeedLeaderboardEntry = (entry) => {
    const isCurrentUser = entry.pubkey === publicKey || entry.isCurrentUser;
    
    return (
      <div key={entry.pubkey} className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}>
        <div className="rank">{entry.rank}</div>
        <div className="runner-info">
          {entry.picture && (
            <div className="runner-avatar">
              <img src={entry.picture} alt={entry.name} />
            </div>
          )}
          <div className="runner-name">
            {isCurrentUser ? `${entry.name} (You)` : entry.name}
          </div>
        </div>
        <div className="time-info">
          <span className="time-value">{entry.timeFormatted}</span>
          <span className="pace-value">{entry.pace}/km</span>
        </div>
      </div>
    );
  };
  
  // Render the distance selector
  const renderDistanceSelector = () => (
    <div className="distance-selector">
      <button 
        className={activeDistanceCategory === '1k' ? 'active' : ''}
        onClick={() => setActiveDistanceCategory('1k')}
      >
        1K
      </button>
      <button 
        className={activeDistanceCategory === '5k' ? 'active' : ''}
        onClick={() => setActiveDistanceCategory('5k')}
      >
        5K
      </button>
      <button 
        className={activeDistanceCategory === '10k' ? 'active' : ''}
        onClick={() => setActiveDistanceCategory('10k')}
      >
        10K
      </button>
    </div>
  );
  
  // Render empty leaderboard message
  const renderEmptyLeaderboard = (type) => {
    if (type === 'streak') {
      return (
        <div className="empty-leaderboard">
          <p>No streak data available yet.</p>
          <p>Start running consistently to build your streak and appear on the leaderboard!</p>
        </div>
      );
    } else { // speed
      return (
        <div className="empty-leaderboard">
          <p>No {activeDistanceCategory} speed data available yet.</p>
          <p>Complete a {activeDistanceCategory} run to see your time on the leaderboard!</p>
        </div>
      );
    }
  };
  
  // Render Leaderboards Tab (with both streak and speed)
  const renderLeaderboardTab = () => {
    return (
      <div className="leaderboard-tab">
        <div className="leaderboard-selector">
          <button 
            className={activeLeaderboard === 'streak' ? 'active' : ''}
            onClick={() => setActiveLeaderboard('streak')}
          >
            Daily Streaks
          </button>
          <button 
            className={activeLeaderboard === 'speed' ? 'active' : ''}
            onClick={() => setActiveLeaderboard('speed')}
          >
            Weekly Speed
          </button>
        </div>
        
        {renderDistanceSelector()}
        
        {activeLeaderboard === 'streak' ? (
          <>
            {currentStreakLeaderboard.length > 0 ? (
              <>
                <div className="leaderboard-header streak-header">
                  <div className="rank">Rank</div>
                  <div className="runner-info">Runner</div>
                  <div className="streak-info">Current Streak</div>
                </div>
                
                <div className="leaderboard-entries">
                  {currentStreakLeaderboard.map(entry => renderStreakLeaderboardEntry(entry))}
                </div>
              </>
            ) : renderEmptyLeaderboard('streak')}
          </>
        ) : (
          <>
            {currentSpeedLeaderboard.length > 0 ? (
              <>
                <div className="leaderboard-header speed-header">
                  <div className="rank">Rank</div>
                  <div className="runner-info">Runner</div>
                  <div className="time-info">Time</div>
                </div>
                
                <div className="leaderboard-entries">
                  {currentSpeedLeaderboard.map(entry => renderSpeedLeaderboardEntry(entry))}
                </div>
              </>
            ) : renderEmptyLeaderboard('speed')}
          </>
        )}
      </div>
    );
  };
  
  // Render the "RUNSTR CHALLENGE coming soon" section
  const renderUpcomingChallengeTab = () => {
    return (
      <div className="upcoming-challenge-tab">
        <div className="coming-soon-card">
          <div className="coming-soon-badge">COMING SOON</div>
          <h2>RUNSTR CHALLENGE</h2>
          <p className="challenge-description">
            Get ready for the ultimate running experience! The RUNSTR CHALLENGE will combine streaks, 
            speed, and distance in a comprehensive monthly competition with prizes and global recognition.
          </p>
        </div>
      </div>
    );
  };
  
  // Main render
  return (
    <div className="events-container">
      {error && <div className="error-message">{error}</div>}
      
      <div className="events-tabs">
        <button 
          className={activeTab === 'streakLeaderboard' ? 'active' : ''}
          onClick={() => setActiveTab('streakLeaderboard')}
        >
          Leaderboards
        </button>
        <button 
          className={activeTab === 'challenges' ? 'active' : ''}
          onClick={() => setActiveTab('challenges')}
        >
          RUNSTR CHALLENGE
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-4">Loading competitions data...</div>
      ) : (
        <>
          {activeTab === 'streakLeaderboard' && renderLeaderboardTab()}
          {activeTab === 'challenges' && renderUpcomingChallengeTab()}
        </>
      )}
    </div>
  );
}; 