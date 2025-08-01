import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Profile Agent
 * Handles user profile management, statistics, achievements, and social features
 */
export class ProfileAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Profile', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices'],
      ...options
    });
    
    this.userProfile = null;
    this.userStats = {
      totalRuns: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      currentStreak: 0,
      longestStreak: 0,
      achievements: []
    };
    this.achievements = [];
    this.socialConnections = [];
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    this.subscribe(MessageTypes.USER_LOGOUT, this.handleUserLogout.bind(this));
    this.subscribe(MessageTypes.ACTIVITY_COMPLETED, this.handleActivityCompleted.bind(this));
    this.subscribe(MessageTypes.STATS_UPDATED, this.handleStatsUpdated.bind(this));
    
    this.setState({
      ready: true,
      userProfile: null,
      userStats: this.userStats,
      achievements: []
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'profile.get':
          return await this.getProfile(payload);
          
        case 'profile.update':
          return await this.updateProfile(payload);
          
        case 'profile.getStats':
          return this.getUserStats(payload);
          
        case 'profile.refreshStats':
          return await this.refreshStats(payload);
          
        case 'achievements.list':
          return this.listAchievements(payload);
          
        case 'achievements.check':
          return await this.checkAchievements(payload);
          
        case 'social.getFollowers':
          return await this.getFollowers(payload);
          
        case 'social.getFollowing':
          return await this.getFollowing(payload);
          
        case 'social.follow':
          return await this.followUser(payload);
          
        case 'social.unfollow':
          return await this.unfollowUser(payload);
          
        case 'leaderboard.getPosition':
          return await this.getLeaderboardPosition(payload);
          
        default:
          return new AgentResponse({
            success: false,
            error: `Unknown message type: ${type}`,
            correlationId: message.correlationId
          });
      }
    } catch (error) {
      return new AgentResponse({
        success: false,
        error: error.message,
        correlationId: message.correlationId
      });
    }
  }

  /**
   * Get user profile
   */
  async getProfile(payload = {}) {
    const { pubkey } = payload;
    
    try {
      // If no pubkey provided, get current user's profile
      if (!pubkey) {
        const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
        if (!authResponse.success || !authResponse.data.isAuthenticated) {
          throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
        }
        
        if (this.userProfile) {
          return new AgentResponse({
            success: true,
            data: { profile: this.userProfile }
          });
        }
        
        // Fetch current user's profile
        return await this.fetchProfile(authResponse.data.publicKey);
      } else {
        // Fetch specific user's profile
        return await this.fetchProfile(pubkey);
      }
      
    } catch (error) {
      throw new AgentError(
        `Failed to get profile: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(payload) {
    const { updates } = payload;
    
    if (!updates || typeof updates !== 'object') {
      throw new AgentError('Profile updates are required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      if (!authResponse.success || !authResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Create profile update event
      const profileEvent = {
        kind: 0, // Profile metadata
        content: JSON.stringify({
          ...this.userProfile,
          ...updates
        }),
        tags: []
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: profileEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to update profile', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Update local profile
      this.userProfile = {
        ...this.userProfile,
        ...updates
      };
      
      this.setState({ userProfile: this.userProfile });
      
      // Broadcast profile update
      await this.broadcast(MessageTypes.PROFILE_UPDATED, {
        profile: this.userProfile,
        updates
      });
      
      return new AgentResponse({
        success: true,
        data: { 
          profile: this.userProfile,
          updated: true 
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to update profile: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get user statistics
   */
  getUserStats(payload = {}) {
    const { detailed = false } = payload;
    
    const stats = { ...this.userStats };
    
    if (detailed) {
      // Add detailed statistics
      stats.averagePace = stats.totalRuns > 0 ? stats.totalDuration / stats.totalDistance : 0;
      stats.averageDistance = stats.totalRuns > 0 ? stats.totalDistance / stats.totalRuns : 0;
      stats.averageDuration = stats.totalRuns > 0 ? stats.totalDuration / stats.totalRuns : 0;
      stats.weeklyDistance = 0; // Would calculate from recent activity
      stats.monthlyDistance = 0; // Would calculate from recent activity
    }
    
    return new AgentResponse({
      success: true,
      data: { stats }
    });
  }

  /**
   * Refresh user statistics
   */
  async refreshStats(payload = {}) {
    try {
      // Get activity history from Dashboard agent
      const historyResponse = await this.sendMessage('Dashboard', 'activity.getHistory', {
        limit: 1000
      });
      
      if (!historyResponse.success) {
        throw new AgentError('Failed to get activity history', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const { history } = historyResponse.data;
      
      // Calculate statistics
      this.userStats = {
        totalRuns: history.length,
        totalDistance: history.reduce((sum, run) => sum + (run.distance || 0), 0),
        totalDuration: history.reduce((sum, run) => sum + (run.duration || 0), 0),
        totalCalories: history.reduce((sum, run) => sum + (run.calories || 0), 0),
        totalSteps: history.reduce((sum, run) => sum + (run.steps || 0), 0),
        currentStreak: this.calculateCurrentStreak(history),
        longestStreak: this.calculateLongestStreak(history),
        achievements: this.achievements.map(a => a.id)
      };
      
      this.setState({ userStats: this.userStats });
      
      // Broadcast stats update
      await this.broadcast(MessageTypes.STATS_UPDATED, {
        stats: this.userStats
      });
      
      return new AgentResponse({
        success: true,
        data: { stats: this.userStats }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to refresh stats: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * List achievements
   */
  listAchievements(payload = {}) {
    const { filter } = payload;
    
    let achievements = [...this.achievements];
    
    if (filter === 'earned') {
      achievements = achievements.filter(a => a.earned);
    } else if (filter === 'available') {
      achievements = achievements.filter(a => !a.earned);
    }
    
    return new AgentResponse({
      success: true,
      data: { achievements }
    });
  }

  /**
   * Check for new achievements
   */
  async checkAchievements(payload = {}) {
    const { activity } = payload;
    
    try {
      const newAchievements = [];
      
      // Define achievement rules
      const achievementRules = [
        {
          id: 'first_run',
          name: 'First Steps',
          description: 'Complete your first run',
          check: () => this.userStats.totalRuns >= 1
        },
        {
          id: 'distance_5k',
          name: '5K Runner',
          description: 'Run 5 kilometers in a single activity',
          check: (act) => act && act.distance >= 5000
        },
        {
          id: 'distance_10k',
          name: '10K Achiever',
          description: 'Run 10 kilometers in a single activity',
          check: (act) => act && act.distance >= 10000
        },
        {
          id: 'streak_7',
          name: 'Week Warrior',
          description: 'Maintain a 7-day running streak',
          check: () => this.userStats.currentStreak >= 7
        },
        {
          id: 'total_100k',
          name: 'Century Club',
          description: 'Run a total of 100 kilometers',
          check: () => this.userStats.totalDistance >= 100000
        }
      ];
      
      // Check each achievement
      for (const rule of achievementRules) {
        const existing = this.achievements.find(a => a.id === rule.id);
        
        if (!existing || !existing.earned) {
          if (rule.check(activity)) {
            const achievement = {
              ...rule,
              earned: true,
              dateEarned: new Date().toISOString()
            };
            
            // Update or add achievement
            const index = this.achievements.findIndex(a => a.id === rule.id);
            if (index >= 0) {
              this.achievements[index] = achievement;
            } else {
              this.achievements.push(achievement);
            }
            
            newAchievements.push(achievement);
          }
        }
      }
      
      if (newAchievements.length > 0) {
        this.setState({ achievements: this.achievements });
        
        // Broadcast new achievements
        for (const achievement of newAchievements) {
          await this.broadcast('achievement.earned', {
            achievement
          });
        }
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          newAchievements,
          totalAchievements: this.achievements.filter(a => a.earned).length
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to check achievements: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Get followers
   */
  async getFollowers(payload = {}) {
    const { pubkey, limit = 50 } = payload;
    
    try {
      const targetPubkey = pubkey || (await this.getCurrentUserPubkey());
      
      if (!targetPubkey) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Fetch contact list events that include this user
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [3], // Contact list
          '#p': [targetPubkey],
          limit
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch followers', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const followers = response.data.map(event => ({
        pubkey: event.pubkey,
        followedAt: event.created_at * 1000
      }));
      
      return new AgentResponse({
        success: true,
        data: { followers }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get followers: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get following
   */
  async getFollowing(payload = {}) {
    const { pubkey } = payload;
    
    try {
      const targetPubkey = pubkey || (await this.getCurrentUserPubkey());
      
      if (!targetPubkey) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Fetch user's contact list
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [3], // Contact list
          authors: [targetPubkey],
          limit: 1
        }
      });
      
      if (!response.success || response.data.length === 0) {
        return new AgentResponse({
          success: true,
          data: { following: [] }
        });
      }
      
      const contactEvent = response.data[0];
      const following = contactEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => ({
          pubkey: tag[1],
          relay: tag[2] || '',
          petname: tag[3] || ''
        }));
      
      return new AgentResponse({
        success: true,
        data: { following }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get following: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Follow a user
   */
  async followUser(payload) {
    const { pubkey, relay, petname } = payload;
    
    if (!pubkey) {
      throw new AgentError('User pubkey is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const currentUserPubkey = await this.getCurrentUserPubkey();
      if (!currentUserPubkey) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Get current following list
      const followingResponse = await this.getFollowing({});
      const currentFollowing = followingResponse.data.following;
      
      // Check if already following
      if (currentFollowing.some(f => f.pubkey === pubkey)) {
        return new AgentResponse({
          success: true,
          data: { 
            followed: false, 
            message: 'Already following this user'
          }
        });
      }
      
      // Add to following list
      const updatedFollowing = [
        ...currentFollowing,
        { pubkey, relay: relay || '', petname: petname || '' }
      ];
      
      // Create contact list event
      const contactEvent = {
        kind: 3,
        content: '',
        tags: updatedFollowing.map(f => ['p', f.pubkey, f.relay, f.petname])
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: contactEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to follow user', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          followed: true,
          pubkey,
          eventId: response.data.eventId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to follow user: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(payload) {
    const { pubkey } = payload;
    
    if (!pubkey) {
      throw new AgentError('User pubkey is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const currentUserPubkey = await this.getCurrentUserPubkey();
      if (!currentUserPubkey) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Get current following list
      const followingResponse = await this.getFollowing({});
      const currentFollowing = followingResponse.data.following;
      
      // Remove from following list
      const updatedFollowing = currentFollowing.filter(f => f.pubkey !== pubkey);
      
      // Create contact list event
      const contactEvent = {
        kind: 3,
        content: '',
        tags: updatedFollowing.map(f => ['p', f.pubkey, f.relay, f.petname])
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: contactEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to unfollow user', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          unfollowed: true,
          pubkey,
          eventId: response.data.eventId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to unfollow user: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get leaderboard position
   */
  async getLeaderboardPosition(payload = {}) {
    const { metric = 'totalDistance', period = 'allTime' } = payload;
    
    try {
      // This would require fetching other users' stats
      // For now, return a placeholder implementation
      
      return new AgentResponse({
        success: true,
        data: {
          position: 1,
          metric,
          period,
          value: this.userStats[metric] || 0,
          totalParticipants: 1
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get leaderboard position: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Fetch profile data
   */
  async fetchProfile(pubkey) {
    const response = await this.sendMessage('CoreServices', 'data.request', {
      type: 'profile',
      params: { pubkey }
    });
    
    if (!response.success) {
      throw new AgentError('Failed to fetch profile', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    const profile = response.data.profile || {};
    
    if (pubkey === (await this.getCurrentUserPubkey())) {
      this.userProfile = profile;
      this.setState({ userProfile: profile });
    }
    
    return new AgentResponse({
      success: true,
      data: { profile }
    });
  }

  /**
   * Get current user's pubkey
   */
  async getCurrentUserPubkey() {
    const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
    return authResponse.success ? authResponse.data.publicKey : null;
  }

  /**
   * Calculate current streak
   */
  calculateCurrentStreak(history) {
    if (!history.length) return 0;
    
    const sortedHistory = [...history].sort((a, b) => b.startTime - a.startTime);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const today = new Date().toDateString();
    
    let streak = 0;
    let currentDate = new Date();
    
    for (const run of sortedHistory) {
      const runDate = new Date(run.startTime);
      const runDateString = runDate.toDateString();
      const expectedDateString = currentDate.toDateString();
      
      if (runDateString === expectedDateString) {
        streak++;
        currentDate = new Date(currentDate.getTime() - oneDayMs);
      } else if (runDateString < expectedDateString) {
        break;
      }
    }
    
    return streak;
  }

  /**
   * Calculate longest streak
   */
  calculateLongestStreak(history) {
    if (!history.length) return 0;
    
    const sortedHistory = [...history].sort((a, b) => a.startTime - b.startTime);
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    let maxStreak = 0;
    let currentStreak = 1;
    
    for (let i = 1; i < sortedHistory.length; i++) {
      const prevDate = new Date(sortedHistory[i - 1].startTime).toDateString();
      const currentDate = new Date(sortedHistory[i].startTime).toDateString();
      const prevDateTime = new Date(prevDate).getTime();
      const currentDateTime = new Date(currentDate).getTime();
      
      if (currentDateTime - prevDateTime <= oneDayMs) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    
    return Math.max(maxStreak, currentStreak);
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    // Load user profile and stats
    try {
      await this.getProfile({});
      await this.refreshStats({});
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  }

  /**
   * Handle user logout
   */
  async handleUserLogout(message) {
    this.userProfile = null;
    this.userStats = {
      totalRuns: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      currentStreak: 0,
      longestStreak: 0,
      achievements: []
    };
    this.achievements = [];
    
    this.setState({
      userProfile: null,
      userStats: this.userStats,
      achievements: []
    });
  }

  /**
   * Handle activity completed
   */
  async handleActivityCompleted(message) {
    const { activity } = message.payload;
    
    // Refresh stats with new activity
    await this.refreshStats({});
    
    // Check for new achievements
    await this.checkAchievements({ activity });
  }

  /**
   * Handle stats updated
   */
  async handleStatsUpdated(message) {
    // External stats update, refresh our data
    await this.refreshStats({});
  }
}