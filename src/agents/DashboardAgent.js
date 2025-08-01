import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Dashboard Agent
 * Handles activity tracking, run management, feed operations, and workout data
 */
export class DashboardAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Dashboard', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices'],
      ...options
    });
    
    this.currentActivity = null;
    this.runHistory = [];
    this.activityMode = 'run';
    this.trackingState = 'idle'; // idle, active, paused
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.ACTIVITY_STARTED, this.handleActivityStarted.bind(this));
    this.subscribe(MessageTypes.ACTIVITY_COMPLETED, this.handleActivityCompleted.bind(this));
    this.subscribe(MessageTypes.ACTIVITY_PAUSED, this.handleActivityPaused.bind(this));
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    
    // Load activity mode from settings
    await this.loadActivityMode();
    
    this.setState({
      ready: true,
      currentActivity: null,
      trackingState: 'idle',
      activityMode: this.activityMode
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'activity.start':
          return await this.startActivity(payload);
          
        case 'activity.pause':
          return await this.pauseActivity(payload);
          
        case 'activity.resume':
          return await this.resumeActivity(payload);
          
        case 'activity.stop':
          return await this.stopActivity(payload);
          
        case 'activity.getCurrentState':
          return this.getCurrentActivityState();
          
        case 'activity.setMode':
          return await this.setActivityMode(payload);
          
        case 'activity.getHistory':
          return await this.getActivityHistory(payload);
          
        case 'feed.get':
          return await this.getFeed(payload);
          
        case 'feed.post':
          return await this.postToFeed(payload);
          
        case 'workout.publish':
          return await this.publishWorkout(payload);
          
        case 'workout.getStats':
          return await this.getWorkoutStats(payload);
          
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
   * Start a new activity
   */
  async startActivity(payload = {}) {
    if (this.trackingState === 'active') {
      throw new AgentError('Activity already in progress', ErrorCodes.STATE_ERROR);
    }
    
    try {
      const { mode = this.activityMode } = payload;
      
      // Initialize activity data
      this.currentActivity = {
        id: crypto.randomUUID(),
        mode,
        startTime: Date.now(),
        endTime: null,
        status: 'active',
        distance: 0,
        duration: 0,
        steps: 0,
        calories: 0,
        elevation: 0,
        pace: 0,
        speed: 0,
        locations: [],
        splits: []
      };
      
      this.trackingState = 'active';
      
      // Start GPS tracking service
      const { RunTracker } = await import('../services/RunTracker.js');
      const runTracker = new RunTracker();
      await runTracker.startTracking();
      
      this.setState({
        currentActivity: this.currentActivity,
        trackingState: this.trackingState
      });
      
      // Broadcast activity started
      await this.broadcast(MessageTypes.ACTIVITY_STARTED, {
        activityId: this.currentActivity.id,
        mode,
        startTime: this.currentActivity.startTime
      });
      
      return new AgentResponse({
        success: true,
        data: {
          activityId: this.currentActivity.id,
          started: true,
          mode
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to start activity: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Pause current activity
   */
  async pauseActivity(payload = {}) {
    if (!this.currentActivity || this.trackingState !== 'active') {
      throw new AgentError('No active activity to pause', ErrorCodes.STATE_ERROR);
    }
    
    try {
      this.trackingState = 'paused';
      this.currentActivity.status = 'paused';
      
      // Pause GPS tracking
      const { RunTracker } = await import('../services/RunTracker.js');
      const runTracker = new RunTracker();
      await runTracker.pauseTracking();
      
      this.setState({
        currentActivity: this.currentActivity,
        trackingState: this.trackingState
      });
      
      // Broadcast activity paused
      await this.broadcast(MessageTypes.ACTIVITY_PAUSED, {
        activityId: this.currentActivity.id,
        pausedAt: Date.now()
      });
      
      return new AgentResponse({
        success: true,
        data: { paused: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to pause activity: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Resume paused activity
   */
  async resumeActivity(payload = {}) {
    if (!this.currentActivity || this.trackingState !== 'paused') {
      throw new AgentError('No paused activity to resume', ErrorCodes.STATE_ERROR);
    }
    
    try {
      this.trackingState = 'active';
      this.currentActivity.status = 'active';
      
      // Resume GPS tracking
      const { RunTracker } = await import('../services/RunTracker.js');
      const runTracker = new RunTracker();
      await runTracker.resumeTracking();
      
      this.setState({
        currentActivity: this.currentActivity,
        trackingState: this.trackingState
      });
      
      // Broadcast activity resumed (reuse ACTIVITY_STARTED event)
      await this.broadcast(MessageTypes.ACTIVITY_STARTED, {
        activityId: this.currentActivity.id,
        resumed: true,
        resumedAt: Date.now()
      });
      
      return new AgentResponse({
        success: true,
        data: { resumed: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to resume activity: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Stop current activity
   */
  async stopActivity(payload = {}) {
    if (!this.currentActivity) {
      throw new AgentError('No activity to stop', ErrorCodes.STATE_ERROR);
    }
    
    try {
      this.currentActivity.endTime = Date.now();
      this.currentActivity.duration = this.currentActivity.endTime - this.currentActivity.startTime;
      this.currentActivity.status = 'completed';
      
      // Stop GPS tracking and get final data
      const { RunTracker } = await import('../services/RunTracker.js');
      const runTracker = new RunTracker();
      const finalData = await runTracker.stopTracking();
      
      // Update activity with final data
      if (finalData) {
        this.currentActivity = {
          ...this.currentActivity,
          ...finalData
        };
      }
      
      // Save to history
      this.runHistory.unshift({ ...this.currentActivity });
      
      // Save to local storage
      const { RunDataService } = await import('../services/RunDataService.js');
      await RunDataService.saveRun(this.currentActivity);
      
      const completedActivity = { ...this.currentActivity };
      
      // Reset current state
      this.currentActivity = null;
      this.trackingState = 'idle';
      
      this.setState({
        currentActivity: null,
        trackingState: 'idle',
        runHistory: this.runHistory
      });
      
      // Broadcast activity completed
      await this.broadcast(MessageTypes.ACTIVITY_COMPLETED, {
        activity: completedActivity
      });
      
      return new AgentResponse({
        success: true,
        data: {
          activity: completedActivity,
          completed: true
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to stop activity: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Get current activity state
   */
  getCurrentActivityState() {
    return new AgentResponse({
      success: true,
      data: {
        currentActivity: this.currentActivity,
        trackingState: this.trackingState,
        activityMode: this.activityMode
      }
    });
  }

  /**
   * Set activity mode
   */
  async setActivityMode(payload) {
    const { mode } = payload;
    const validModes = ['run', 'walk', 'cycle'];
    
    if (!validModes.includes(mode)) {
      throw new AgentError('Invalid activity mode', ErrorCodes.VALIDATION_ERROR);
    }
    
    this.activityMode = mode;
    
    // Save to settings
    const { useActivityMode } = await import('../contexts/ActivityModeContext.js');
    // This would need to be integrated with the settings system
    
    this.setState({ activityMode: mode });
    
    return new AgentResponse({
      success: true,
      data: { mode }
    });
  }

  /**
   * Get activity history
   */
  async getActivityHistory(payload = {}) {
    const { limit = 50, offset = 0 } = payload;
    
    try {
      // Load from local storage if not already loaded
      if (this.runHistory.length === 0) {
        const { RunDataService } = await import('../services/RunDataService.js');
        const runs = await RunDataService.getAllRuns();
        this.runHistory = runs.sort((a, b) => b.startTime - a.startTime);
      }
      
      const history = this.runHistory.slice(offset, offset + limit);
      
      return new AgentResponse({
        success: true,
        data: {
          history,
          total: this.runHistory.length,
          hasMore: offset + limit < this.runHistory.length
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get activity history: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get activity feed
   */
  async getFeed(payload = {}) {
    const { limit = 20, since } = payload;
    
    try {
      // Get feed data from CoreServices
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [31923], // Run events
          limit,
          since
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch feed', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Process feed items
      const feedItems = response.data.map(event => this.parseFeedEvent(event));
      
      return new AgentResponse({
        success: true,
        data: { feedItems }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get feed: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Post to activity feed
   */
  async postToFeed(payload) {
    const { content, activity } = payload;
    
    try {
      // Create post event
      const postEvent = {
        kind: 1, // Text note
        content: content,
        tags: []
      };
      
      // Add activity reference if provided
      if (activity) {
        postEvent.tags.push(['e', activity.id, '', 'mention']);
      }
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: postEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to post to feed', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: {
          postId: response.data.eventId,
          posted: true
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to post to feed: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Publish workout to Nostr
   */
  async publishWorkout(payload) {
    const { activity, includeTeam = true } = payload;
    
    if (!activity) {
      throw new AgentError('Activity data is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Get default team if includeTeam is true
      let teamTags = [];
      if (includeTeam) {
        const teamResponse = await this.sendMessage('Teams', 'team.getDefault', {});
        if (teamResponse.success && teamResponse.data.defaultTeam) {
          const [captainPubkey, teamUUID] = teamResponse.data.defaultTeam.split(':');
          teamTags = [
            ['h', teamUUID],
            ['p', captainPubkey, '', 'team']
          ];
        }
      }
      
      // Create workout event
      const workoutEvent = {
        kind: 31923, // Runstr workout event
        content: JSON.stringify({
          type: activity.mode,
          distance: activity.distance,
          duration: activity.duration,
          pace: activity.pace,
          speed: activity.speed,
          calories: activity.calories,
          elevation: activity.elevation,
          steps: activity.steps
        }),
        tags: [
          ['d', activity.id],
          ['type', activity.mode],
          ['distance', activity.distance.toString()],
          ['duration', activity.duration.toString()],
          ['start_time', activity.startTime.toString()],
          ['end_time', activity.endTime.toString()],
          ...teamTags
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: workoutEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to publish workout', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: {
          eventId: response.data.eventId,
          published: true
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to publish workout: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get workout statistics
   */
  async getWorkoutStats(payload = {}) {
    const { period = 'week', activity_type } = payload;
    
    try {
      // Calculate stats from history
      const now = Date.now();
      let startTime;
      
      switch (period) {
        case 'day':
          startTime = now - (24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = now - (30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = 0;
      }
      
      let filteredHistory = this.runHistory.filter(run => run.startTime >= startTime);
      
      if (activity_type) {
        filteredHistory = filteredHistory.filter(run => run.mode === activity_type);
      }
      
      const stats = {
        totalRuns: filteredHistory.length,
        totalDistance: filteredHistory.reduce((sum, run) => sum + (run.distance || 0), 0),
        totalDuration: filteredHistory.reduce((sum, run) => sum + (run.duration || 0), 0),
        totalCalories: filteredHistory.reduce((sum, run) => sum + (run.calories || 0), 0),
        totalSteps: filteredHistory.reduce((sum, run) => sum + (run.steps || 0), 0),
        averagePace: 0,
        averageSpeed: 0
      };
      
      if (stats.totalRuns > 0) {
        stats.averagePace = filteredHistory.reduce((sum, run) => sum + (run.pace || 0), 0) / stats.totalRuns;
        stats.averageSpeed = filteredHistory.reduce((sum, run) => sum + (run.speed || 0), 0) / stats.totalRuns;
      }
      
      return new AgentResponse({
        success: true,
        data: { stats, period }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get workout stats: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Load activity mode from settings
   */
  async loadActivityMode() {
    try {
      // This would integrate with the settings system
      const savedMode = localStorage.getItem('activityMode');
      if (savedMode && ['run', 'walk', 'cycle'].includes(savedMode)) {
        this.activityMode = savedMode;
      }
    } catch (error) {
      console.warn('Failed to load activity mode:', error);
    }
  }

  /**
   * Parse feed event
   */
  parseFeedEvent(event) {
    try {
      const content = JSON.parse(event.content || '{}');
      
      return {
        id: event.id,
        author: event.pubkey,
        type: content.type || 'unknown',
        distance: content.distance || 0,
        duration: content.duration || 0,
        pace: content.pace || 0,
        calories: content.calories || 0,
        timestamp: event.created_at * 1000,
        tags: event.tags
      };
    } catch (error) {
      return {
        id: event.id,
        author: event.pubkey,
        content: event.content,
        timestamp: event.created_at * 1000,
        tags: event.tags
      };
    }
  }

  /**
   * Handle activity started event
   */
  async handleActivityStarted(message) {
    // Update internal state if needed
    console.log('Activity started:', message.payload);
  }

  /**
   * Handle activity completed event
   */
  async handleActivityCompleted(message) {
    // Potentially trigger auto-publishing or other actions
    const { activity } = message.payload;
    
    // Check settings for auto-publish
    try {
      const settings = await this.sendMessage('Settings', 'settings.get', { key: 'autoPostToNostr' });
      if (settings.success && settings.data.value) {
        await this.publishWorkout({ activity });
      }
    } catch (error) {
      console.warn('Failed to auto-publish workout:', error);
    }
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    // Reload user's activity history
    try {
      const { RunDataService } = await import('../services/RunDataService.js');
      const runs = await RunDataService.getAllRuns();
      this.runHistory = runs.sort((a, b) => b.startTime - a.startTime);
      
      this.setState({ runHistory: this.runHistory });
    } catch (error) {
      console.error('Failed to load run history:', error);
    }
  }
}