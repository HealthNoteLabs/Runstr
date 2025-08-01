import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * League Agent
 * Handles club features, leaderboards, competitions, and league-based social interactions
 */
export class LeagueAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('League', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices', 'Profile'],
      ...options
    });
    
    this.currentLeague = null;
    this.leaderboards = new Map();
    this.competitions = [];
    this.userRankings = new Map();
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    this.subscribe(MessageTypes.ACTIVITY_COMPLETED, this.handleActivityCompleted.bind(this));
    this.subscribe(MessageTypes.STATS_UPDATED, this.handleStatsUpdated.bind(this));
    
    this.setState({
      ready: true,
      currentLeague: null,
      leaderboards: {},
      competitions: []
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'league.join':
          return await this.joinLeague(payload);
          
        case 'league.leave':
          return await this.leaveLeague(payload);
          
        case 'league.getCurrent':
          return this.getCurrentLeague();
          
        case 'league.getInfo':
          return await this.getLeagueInfo(payload);
          
        case 'leaderboard.get':
          return await this.getLeaderboard(payload);
          
        case 'leaderboard.getPosition':
          return await this.getLeaderboardPosition(payload);
          
        case 'leaderboard.getTop':
          return await this.getTopRunners(payload);
          
        case 'competition.list':
          return await this.listCompetitions(payload);
          
        case 'competition.join':
          return await this.joinCompetition(payload);
          
        case 'competition.getDetails':
          return await this.getCompetitionDetails(payload);
          
        case 'club.getMembers':
          return await this.getClubMembers(payload);
          
        case 'club.getActivity':
          return await this.getClubActivity(payload);
          
        case 'ranking.update':
          return await this.updateRankings(payload);
          
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
   * Join a league
   */
  async joinLeague(payload) {
    const { leagueId, leagueName } = payload;
    
    if (!leagueId) {
      throw new AgentError('League ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      if (!authResponse.success || !authResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Create league join event
      const joinEvent = {
        kind: 30023, // Categorized bookmarks (repurposed for league membership)
        content: JSON.stringify({
          action: 'join',
          leagueId,
          leagueName: leagueName || `League ${leagueId}`
        }),
        tags: [
          ['d', `league:${leagueId}`],
          ['t', 'league'],
          ['league', leagueId],
          ['action', 'join']
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: joinEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to join league', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      this.currentLeague = {
        id: leagueId,
        name: leagueName || `League ${leagueId}`,
        joinedAt: Date.now()
      };
      
      this.setState({ currentLeague: this.currentLeague });
      
      // Load league data
      await this.loadLeagueData(leagueId);
      
      return new AgentResponse({
        success: true,
        data: {
          joined: true,
          league: this.currentLeague,
          eventId: response.data.eventId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to join league: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Leave current league
   */
  async leaveLeague(payload = {}) {
    if (!this.currentLeague) {
      throw new AgentError('Not currently in a league', ErrorCodes.STATE_ERROR);
    }
    
    try {
      const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      if (!authResponse.success || !authResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Create league leave event
      const leaveEvent = {
        kind: 30023,
        content: JSON.stringify({
          action: 'leave',
          leagueId: this.currentLeague.id
        }),
        tags: [
          ['d', `league:${this.currentLeague.id}`],
          ['t', 'league'],
          ['league', this.currentLeague.id],
          ['action', 'leave']
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: leaveEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to leave league', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const leftLeague = this.currentLeague;
      this.currentLeague = null;
      this.leaderboards.clear();
      this.competitions = [];
      
      this.setState({
        currentLeague: null,
        leaderboards: {},
        competitions: []
      });
      
      return new AgentResponse({
        success: true,
        data: {
          left: true,
          league: leftLeague,
          eventId: response.data.eventId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to leave league: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get current league
   */
  getCurrentLeague() {
    return new AgentResponse({
      success: true,
      data: { league: this.currentLeague }
    });
  }

  /**
   * Get league information
   */
  async getLeagueInfo(payload) {
    const { leagueId } = payload;
    
    if (!leagueId) {
      throw new AgentError('League ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Fetch league events
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [30023],
          '#league': [leagueId],
          limit: 100
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch league info', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Process league data
      const members = new Set();
      let leagueName = `League ${leagueId}`;
      
      for (const event of response.data) {
        try {
          const content = JSON.parse(event.content);
          if (content.action === 'join') {
            members.add(event.pubkey);
            if (content.leagueName) {
              leagueName = content.leagueName;
            }
          } else if (content.action === 'leave') {
            members.delete(event.pubkey);
          }
        } catch (error) {
          console.warn('Failed to parse league event:', error);
        }
      }
      
      const leagueInfo = {
        id: leagueId,
        name: leagueName,
        memberCount: members.size,
        members: Array.from(members)
      };
      
      return new AgentResponse({
        success: true,
        data: { league: leagueInfo }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get league info: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(payload) {
    const { 
      metric = 'totalDistance', 
      period = 'week', 
      limit = 20,
      leagueId 
    } = payload;
    
    const targetLeagueId = leagueId || this.currentLeague?.id;
    
    if (!targetLeagueId) {
      throw new AgentError('No league specified', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Get league members
      const leagueResponse = await this.getLeagueInfo({ leagueId: targetLeagueId });
      if (!leagueResponse.success) {
        throw new AgentError('Failed to get league info', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const { members } = leagueResponse.data.league;
      
      // Calculate time range for period
      const now = Date.now();
      let startTime = 0;
      
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
        case 'year':
          startTime = now - (365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = 0; // All time
      }
      
      // Fetch activities for league members
      const leaderboard = [];
      
      for (const memberPubkey of members.slice(0, limit)) {
        try {
          // Fetch member's activities
          const activitiesResponse = await this.sendMessage('CoreServices', 'nostr.fetch', {
            filter: {
              kinds: [31923], // Run events
              authors: [memberPubkey],
              since: Math.floor(startTime / 1000),
              limit: 100
            }
          });
          
          if (activitiesResponse.success) {
            let metricValue = 0;
            let activityCount = 0;
            
            for (const event of activitiesResponse.data) {
              try {
                const content = JSON.parse(event.content);
                activityCount++;
                
                switch (metric) {
                  case 'totalDistance':
                    metricValue += content.distance || 0;
                    break;
                  case 'totalDuration':
                    metricValue += content.duration || 0;
                    break;
                  case 'totalCalories':
                    metricValue += content.calories || 0;
                    break;
                  case 'activityCount':
                    metricValue = activityCount;
                    break;
                  case 'averagePace':
                    if (content.pace) {
                      metricValue = (metricValue * (activityCount - 1) + content.pace) / activityCount;
                    }
                    break;
                }
              } catch (error) {
                console.warn('Failed to parse activity event:', error);
              }
            }
            
            if (metricValue > 0 || metric === 'activityCount') {
              leaderboard.push({
                pubkey: memberPubkey,
                value: metricValue,
                activityCount
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch activities for ${memberPubkey}:`, error);
        }
      }
      
      // Sort leaderboard
      leaderboard.sort((a, b) => {
        if (metric === 'averagePace') {
          return a.value - b.value; // Lower pace is better
        }
        return b.value - a.value; // Higher values are better for other metrics
      });
      
      // Add rankings
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      // Cache leaderboard
      const cacheKey = `${targetLeagueId}:${metric}:${period}`;
      this.leaderboards.set(cacheKey, {
        leaderboard,
        updatedAt: Date.now()
      });
      
      return new AgentResponse({
        success: true,
        data: {
          leaderboard: leaderboard.slice(0, limit),
          metric,
          period,
          leagueId: targetLeagueId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get leaderboard: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get user's leaderboard position
   */
  async getLeaderboardPosition(payload) {
    const { metric = 'totalDistance', period = 'week', leagueId } = payload;
    
    try {
      const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      if (!authResponse.success || !authResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      const userPubkey = authResponse.data.publicKey;
      
      // Get full leaderboard
      const leaderboardResponse = await this.getLeaderboard({
        metric,
        period,
        leagueId,
        limit: 1000 // Get all entries to find position
      });
      
      if (!leaderboardResponse.success) {
        throw new AgentError('Failed to get leaderboard', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const { leaderboard } = leaderboardResponse.data;
      const userEntry = leaderboard.find(entry => entry.pubkey === userPubkey);
      
      if (!userEntry) {
        return new AgentResponse({
          success: true,
          data: {
            position: null,
            value: 0,
            metric,
            period,
            totalParticipants: leaderboard.length
          }
        });
      }
      
      return new AgentResponse({
        success: true,
        data: {
          position: userEntry.rank,
          value: userEntry.value,
          metric,
          period,
          totalParticipants: leaderboard.length
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
   * Get top runners
   */
  async getTopRunners(payload) {
    const { limit = 10, metric = 'totalDistance', period = 'week' } = payload;
    
    try {
      const leaderboardResponse = await this.getLeaderboard({
        metric,
        period,
        limit
      });
      
      if (!leaderboardResponse.success) {
        throw new AgentError('Failed to get leaderboard', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: {
          topRunners: leaderboardResponse.data.leaderboard,
          metric,
          period
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get top runners: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * List competitions
   */
  async listCompetitions(payload = {}) {
    const { status = 'active', limit = 20 } = payload;
    
    try {
      // Fetch competition events
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [30024], // Competition events (custom kind)
          '#t': ['competition'],
          limit
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch competitions', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Process competitions
      const competitions = response.data
        .map(event => this.parseCompetitionEvent(event))
        .filter(comp => comp !== null);
      
      // Filter by status
      const now = Date.now();
      const filteredCompetitions = competitions.filter(comp => {
        switch (status) {
          case 'active':
            return comp.startTime <= now && comp.endTime > now;
          case 'upcoming':
            return comp.startTime > now;
          case 'completed':
            return comp.endTime <= now;
          default:
            return true;
        }
      });
      
      this.competitions = filteredCompetitions;
      this.setState({ competitions: this.competitions });
      
      return new AgentResponse({
        success: true,
        data: { competitions: filteredCompetitions }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to list competitions: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Join a competition
   */
  async joinCompetition(payload) {
    const { competitionId } = payload;
    
    if (!competitionId) {
      throw new AgentError('Competition ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      if (!authResponse.success || !authResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Create competition join event
      const joinEvent = {
        kind: 30025, // Competition participation
        content: JSON.stringify({
          action: 'join',
          competitionId
        }),
        tags: [
          ['d', `competition:${competitionId}`],
          ['t', 'competition-participation'],
          ['competition', competitionId],
          ['action', 'join']
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: joinEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to join competition', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: {
          joined: true,
          competitionId,
          eventId: response.data.eventId
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to join competition: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Load league data
   */
  async loadLeagueData(leagueId) {
    try {
      // Load leaderboards for different metrics
      const metrics = ['totalDistance', 'totalDuration', 'activityCount'];
      const periods = ['week', 'month'];
      
      for (const metric of metrics) {
        for (const period of periods) {
          await this.getLeaderboard({
            metric,
            period,
            leagueId,
            limit: 50
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load league data:', error);
    }
  }

  /**
   * Parse competition event
   */
  parseCompetitionEvent(event) {
    try {
      const content = JSON.parse(event.content || '{}');
      const nameTag = event.tags.find(tag => tag[0] === 'name');
      const startTag = event.tags.find(tag => tag[0] === 'start_time');
      const endTag = event.tags.find(tag => tag[0] === 'end_time');
      const typeTag = event.tags.find(tag => tag[0] === 'comp_type');
      
      return {
        id: event.id,
        name: nameTag?.[1] || content.name || 'Unnamed Competition',
        description: content.description || '',
        type: typeTag?.[1] || content.type || 'distance',
        startTime: parseInt(startTag?.[1]) || Date.now(),
        endTime: parseInt(endTag?.[1]) || Date.now() + (7 * 24 * 60 * 60 * 1000),
        creator: event.pubkey,
        createdAt: event.created_at * 1000,
        rules: content.rules || {}
      };
    } catch (error) {
      console.error('Failed to parse competition event:', error);
      return null;
    }
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    // Load user's league membership and data
    try {
      const { publicKey } = message.payload;
      
      // Check if user is in a league
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [30023],
          authors: [publicKey],
          '#t': ['league'],
          limit: 1
        }
      });
      
      if (response.success && response.data.length > 0) {
        const leagueEvent = response.data[0];
        try {
          const content = JSON.parse(leagueEvent.content);
          if (content.action === 'join') {
            this.currentLeague = {
              id: content.leagueId,
              name: content.leagueName,
              joinedAt: leagueEvent.created_at * 1000
            };
            
            this.setState({ currentLeague: this.currentLeague });
            await this.loadLeagueData(this.currentLeague.id);
          }
        } catch (error) {
          console.warn('Failed to parse league event:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load league data on login:', error);
    }
  }

  /**
   * Handle activity completed
   */
  async handleActivityCompleted(message) {
    // Update leaderboards when user completes activity
    if (this.currentLeague) {
      // Invalidate cached leaderboards to force refresh
      this.leaderboards.clear();
    }
  }

  /**
   * Handle stats updated
   */
  async handleStatsUpdated(message) {
    // Refresh leaderboards when stats are updated
    if (this.currentLeague) {
      this.leaderboards.clear();
    }
  }
}