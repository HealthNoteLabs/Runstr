import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { initializeNostr } from '../utils/nostr';

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
  
  // Generate random streak data for testing
  const generateStreakData = useCallback((distance) => {
    const baseStreaks = {
      '1k': [38, 35, 28, 25, 21, 19, 16, 12, 10, 7, 5, 3, 1],
      '5k': [65, 42, 30, 28, 21, 19, 16, 14, 10, 8, 5, 3, 1],
      '10k': [30, 25, 18, 15, 14, 12, 10, 8, 7, 5, 3, 2, 1]
    };
    
    const userNames = [
      'Marathon Master', 
      'Daily Runner', 
      'Jogging Jane', 
      'Running Rob', 
      'Sprinter Sam', 
      'Trailblazer Tom', 
      'Endurance Eva', 
      'Hill Climber Harold', 
      'Pace Keeper Pam', 
      'Distance Dominator',
      'Newbie Nate',
      'Casual Carol',
      'First-timer Fred'
    ];
    
    const users = userNames.map((name, index) => ({
      pubkey: `user${index + 1}`,
      name,
      streak: baseStreaks[distance][index],
      picture: `https://i.pravatar.cc/150?img=${index + 1}`
    }));
    
    // If current user exists, add them with a random position in the leaderboard
    if (publicKey) {
      // For the current user, we'll use a default profile
      const userName = 'You';
      const userPicture = '';
      
      // Get user's streak from localStorage if available
      let userStreak = 0;
      try {
        const storedStats = localStorage.getItem('runStats');
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          
          // Use the actual streak if available, otherwise generate a random one
          if (stats.currentStreak) {
            userStreak = stats.currentStreak;
          } else {
            // Random streak between 1 and the max streak
            userStreak = Math.floor(Math.random() * baseStreaks[distance][0]) + 1;
          }
        } else {
          // Random streak if no stats available
          userStreak = Math.floor(Math.random() * baseStreaks[distance][0]) + 1;
        }
      } catch (err) {
        console.error('Error parsing user stats:', err);
        userStreak = Math.floor(Math.random() * baseStreaks[distance][0]) + 1;
      }
      
      users.push({
        pubkey: publicKey,
        name: userName,
        streak: userStreak,
        picture: userPicture,
        isCurrentUser: true
      });
    }
    
    // Sort by streak (descending)
    const sortedUsers = users.sort((a, b) => b.streak - a.streak);
    
    // Add rank to each user
    return sortedUsers.map((user, index) => ({
      ...user,
      rank: index + 1
    }));
  }, [publicKey]);
  
  // Generate random speed data for testing
  const generateSpeedData = useCallback((distance) => {
    // Distance in km
    const distanceMap = {
      '1k': 1,
      '5k': 5,
      '10k': 10
    };
    
    const distanceKm = distanceMap[distance];
    
    // Base time ranges in seconds for each distance (from fastest to slowest)
    const baseTimeRanges = {
      '1k': [180, 240], // 3-4 minutes
      '5k': [1020, 1800], // 17-30 minutes
      '5k_elite': [840, 1020], // 14-17 minutes (elite runners)
      '10k': [2100, 3600], // 35-60 minutes
      '10k_elite': [1800, 2100] // 30-35 minutes (elite runners)
    };
    
    const userNames = [
      'Speed Demon', 
      'Quick Feet', 
      'Lightning Lucy', 
      'Rapid Ryan', 
      'Turbo Tim', 
      'Fast Freddie', 
      'Velocity Vera', 
      'Hasty Hannah', 
      'Quick Quincy', 
      'Zippy Zach',
      'Bolt Barry',
      'Swift Sarah',
      'Rapid Rachel'
    ];
    
    let users = [];
    
    // Create an elite runner for 5k and 10k
    if (distance === '5k' || distance === '10k') {
      const timeRange = baseTimeRanges[`${distance}_elite`];
      const eliteUser = {
        pubkey: 'elite_runner',
        name: distance === '5k' ? 'Elite 5K Pro' : 'Elite 10K Pro',
        time: Math.floor(Math.random() * (timeRange[1] - timeRange[0]) + timeRange[0]),
        picture: 'https://i.pravatar.cc/150?img=50',
        created_at: Math.floor(Date.now() / 1000) - (Math.floor(Math.random() * 604800)) // Within last week
      };
      users.push(eliteUser);
    }
    
    // Generate random users
    for (let i = 0; i < userNames.length; i++) {
      const timeRange = baseTimeRanges[distance];
      const user = {
        pubkey: `speed_user${i + 1}`,
        name: userNames[i],
        time: Math.floor(Math.random() * (timeRange[1] - timeRange[0]) + timeRange[0]),
        picture: `https://i.pravatar.cc/150?img=${i + 20}`, // Different avatars from streak users
        created_at: Math.floor(Date.now() / 1000) - (Math.floor(Math.random() * 604800)) // Within last week
      };
      users.push(user);
    }
    
    // If current user exists, add them with a random position in the leaderboard
    if (publicKey) {
      // For the current user, we'll use a default profile
      const userName = 'You';
      const userPicture = '';
      
      // Try to get actual time from local storage if available
      let userTime = 0;
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
          } else {
            // No matching runs, generate random time
            const timeRange = baseTimeRanges[distance];
            userTime = Math.floor(Math.random() * (timeRange[1] - timeRange[0]) + timeRange[0]);
          }
        } else {
          // No run history, generate random time
          const timeRange = baseTimeRanges[distance];
          userTime = Math.floor(Math.random() * (timeRange[1] - timeRange[0]) + timeRange[0]);
        }
      } catch (err) {
        console.error('Error parsing user run history:', err);
        // Fallback to random time
        const timeRange = baseTimeRanges[distance];
        userTime = Math.floor(Math.random() * (timeRange[1] - timeRange[0]) + timeRange[0]);
      }
      
      users.push({
        pubkey: publicKey,
        name: userName,
        time: userTime,
        picture: userPicture,
        isCurrentUser: true,
        created_at: Math.floor(Date.now() / 1000) - (Math.floor(Math.random() * 604800)) // Within last week
      });
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
  }, [publicKey, formatSecondsToTime, calculatePace]);
  
  // Load streak leaderboards for all distance categories
  const loadStreakLeaderboards = useCallback(async () => {
    try {
      // Load streak leaderboards for each distance category
      const streaks1k = generateStreakData('1k');
      const streaks5k = generateStreakData('5k');
      const streaks10k = generateStreakData('10k');
      
      setStreakLeaderboard1k(streaks1k);
      setStreakLeaderboard5k(streaks5k);
      setStreakLeaderboard10k(streaks10k);
      
    } catch (err) {
      console.error('Error loading streak leaderboards:', err);
    }
  }, [generateStreakData]);
  
  // Load speed leaderboards for all distance categories
  const loadSpeedLeaderboards = useCallback(async () => {
    try {
      // Load speed leaderboards for each distance category
      const speeds1k = generateSpeedData('1k');
      const speeds5k = generateSpeedData('5k');
      const speeds10k = generateSpeedData('10k');
      
      setSpeedLeaderboard1k(speeds1k);
      setSpeedLeaderboard5k(speeds5k);
      setSpeedLeaderboard10k(speeds10k);
      
    } catch (err) {
      console.error('Error loading speed leaderboards:', err);
    }
  }, [generateSpeedData]);
  
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
  }, [loadStreakLeaderboards, loadSpeedLeaderboards]);
  
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
            <div className="competition-description">
              <p>Daily streak competition - run {activeDistanceCategory} every day to build your streak!</p>
              <p className="auto-enroll">Users are automatically enrolled - just keep running!</p>
            </div>
            
            <div className="leaderboard-header streak-header">
              <div className="rank">Rank</div>
              <div className="runner-info">Runner</div>
              <div className="streak-info">Current Streak</div>
            </div>
            
            <div className="leaderboard-entries">
              {currentStreakLeaderboard.length === 0 
                ? <p className="no-entries">No streak data available. Start running to join the competition!</p>
                : currentStreakLeaderboard.map(entry => renderStreakLeaderboardEntry(entry))
              }
            </div>
          </>
        ) : (
          <>
            <div className="competition-description">
              <p>Weekly speed competition - your fastest {activeDistanceCategory} time this week!</p>
              <p className="auto-enroll">Users are automatically enrolled - run faster to climb the leaderboard!</p>
            </div>
            
            <div className="leaderboard-header speed-header">
              <div className="rank">Rank</div>
              <div className="runner-info">Runner</div>
              <div className="time-info">Time</div>
            </div>
            
            <div className="leaderboard-entries">
              {currentSpeedLeaderboard.length === 0 
                ? <p className="no-entries">No speed data available. Record a {activeDistanceCategory} run to join the competition!</p>
                : currentSpeedLeaderboard.map(entry => renderSpeedLeaderboardEntry(entry))
              }
            </div>
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
          <div className="challenge-features">
            <div className="feature">
              <h3>Global Competition</h3>
              <p>Compete with runners from around the world in various categories.</p>
            </div>
            <div className="feature">
              <h3>Monthly Themes</h3>
              <p>Each month brings a new theme with unique goals and achievements.</p>
            </div>
            <div className="feature">
              <h3>Exclusive Rewards</h3>
              <p>Earn digital badges, NFTs, and potential physical rewards.</p>
            </div>
          </div>
          <div className="notify-section">
            <p>Be the first to know when RUNSTR CHALLENGE launches!</p>
            <button className="notify-btn">Get Notified</button>
          </div>
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
        <div className="loading-spinner">Loading competitions data...</div>
      ) : (
        <>
          {activeTab === 'streakLeaderboard' && renderLeaderboardTab()}
          {activeTab === 'challenges' && renderUpcomingChallengeTab()}
        </>
      )}
    </div>
  );
}; 