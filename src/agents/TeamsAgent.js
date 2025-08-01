import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Teams Agent
 * Handles all team-related functionality including management, chat, events, and member operations
 */
export class TeamsAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Teams', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices'],
      ...options
    });
    
    this.currentTeam = null;
    this.userTeams = [];
    this.teamMembers = new Map();
    this.teamEvents = new Map();
    this.defaultPostingTeam = null;
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    this.subscribe(MessageTypes.USER_LOGOUT, this.handleUserLogout.bind(this));
    this.subscribe(MessageTypes.TEAM_UPDATED, this.handleTeamUpdate.bind(this));
    
    this.setState({
      ready: true,
      currentTeam: null,
      userTeams: [],
      defaultPostingTeam: null
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'team.list':
          return await this.listTeams(payload);
          
        case 'team.create':
          return await this.createTeam(payload);
          
        case 'team.join':
          return await this.joinTeam(payload);
          
        case 'team.leave':
          return await this.leaveTeam(payload);
          
        case 'team.get':
          return await this.getTeam(payload);
          
        case 'team.update':
          return await this.updateTeam(payload);
          
        case 'team.setDefault':
          return await this.setDefaultPostingTeam(payload);
          
        case 'team.getDefault':
          return this.getDefaultPostingTeam();
          
        case 'team.members.list':
          return await this.listTeamMembers(payload);
          
        case 'team.members.add':
          return await this.addTeamMember(payload);
          
        case 'team.members.remove':
          return await this.removeTeamMember(payload);
          
        case 'team.events.list':
          return await this.listTeamEvents(payload);
          
        case 'team.events.create':
          return await this.createTeamEvent(payload);
          
        case 'team.chat.send':
          return await this.sendChatMessage(payload);
          
        case 'team.chat.history':
          return await this.getChatHistory(payload);
          
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
   * List all available teams
   */
  async listTeams(payload = {}) {
    try {
      const { limit = 50, offset = 0 } = payload;
      
      // Request team data from CoreServices
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [39000], // NIP-29 group metadata events
          limit: limit + offset
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch teams', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Process and format team data
      const teams = response.data
        .slice(offset)
        .map(event => this.parseTeamEvent(event))
        .filter(team => team !== null);
      
      return new AgentResponse({
        success: true,
        data: {
          teams,
          hasMore: response.data.length > limit + offset
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to list teams: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Create a new team
   */
  async createTeam(payload) {
    const { name, description, isPublic = true, rules = [] } = payload;
    
    if (!name || name.trim().length === 0) {
      throw new AgentError('Team name is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Generate team UUID
      const teamUUID = crypto.randomUUID();
      
      // Create team metadata event
      const teamEvent = {
        kind: 39000,
        content: JSON.stringify({
          name: name.trim(),
          about: description || '',
          rules: rules
        }),
        tags: [
          ['d', teamUUID],
          ['name', name.trim()],
          ['about', description || ''],
          ['public', isPublic.toString()],
          ...rules.map(rule => ['rule', rule])
        ]
      };
      
      // Publish via CoreServices
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: teamEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to create team', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const team = {
        id: response.data.eventId,
        uuid: teamUUID,
        name: name.trim(),
        description: description || '',
        isPublic,
        rules,
        createdAt: new Date().toISOString()
      };
      
      // Broadcast team creation
      await this.broadcast(MessageTypes.TEAM_EVENT_CREATED, {
        action: 'created',
        team
      });
      
      return new AgentResponse({
        success: true,
        data: team
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to create team: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Join a team
   */
  async joinTeam(payload) {
    const { teamUUID, captainPubkey } = payload;
    
    if (!teamUUID || !captainPubkey) {
      throw new AgentError('Team UUID and captain pubkey are required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Import team join functionality
      const { joinGroup } = await import('../utils/ndkGroups.js');
      const coreResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      
      if (!coreResponse.success || !coreResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Get NDK instance
      const ndkResponse = await this.sendMessage('CoreServices', 'nostr.connect', {});
      if (!ndkResponse.success) {
        throw new AgentError('Nostr connection required', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Join the team using existing utility
      const result = await joinGroup(teamUUID, captainPubkey);
      
      if (result.success) {
        // Update local state
        await this.loadUserTeams();
        
        // Broadcast join event
        await this.broadcast(MessageTypes.TEAM_JOINED, {
          teamUUID,
          captainPubkey,
          userPubkey: coreResponse.data.publicKey
        });
        
        return new AgentResponse({
          success: true,
          data: { joined: true, teamUUID }
        });
      } else {
        throw new AgentError(result.error || 'Failed to join team', ErrorCodes.COMMUNICATION_ERROR);
      }
      
    } catch (error) {
      throw new AgentError(
        `Failed to join team: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Leave a team
   */
  async leaveTeam(payload) {
    const { teamUUID, captainPubkey } = payload;
    
    try {
      const coreResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      
      if (!coreResponse.success || !coreResponse.data.isAuthenticated) {
        throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
      }
      
      // Create leave request event
      const leaveEvent = {
        kind: 9021, // NIP-29 leave request
        content: '',
        tags: [
          ['h', teamUUID],
          ['p', captainPubkey]
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: leaveEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to leave team', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Update local state
      this.userTeams = this.userTeams.filter(team => 
        !(team.uuid === teamUUID && team.captainPubkey === captainPubkey)
      );
      
      // Clear default if this was the default team
      if (this.defaultPostingTeam === `${captainPubkey}:${teamUUID}`) {
        this.defaultPostingTeam = null;
        const { setDefaultPostingTeamIdentifier } = await import('../utils/settingsManager.js');
        setDefaultPostingTeamIdentifier(null);
      }
      
      this.setState({
        userTeams: this.userTeams,
        defaultPostingTeam: this.defaultPostingTeam
      });
      
      // Broadcast leave event
      await this.broadcast(MessageTypes.TEAM_LEFT, {
        teamUUID,
        captainPubkey,
        userPubkey: coreResponse.data.publicKey
      });
      
      return new AgentResponse({
        success: true,
        data: { left: true, teamUUID }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to leave team: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Set default posting team
   */
  async setDefaultPostingTeam(payload) {
    const { captainPubkey, teamUUID, teamName } = payload;
    
    try {
      const teamId = `${captainPubkey}:${teamUUID}`;
      this.defaultPostingTeam = teamId;
      
      // Persist to settings
      const { setDefaultPostingTeamIdentifier, cacheTeamName } = await import('../utils/settingsManager.js');
      setDefaultPostingTeamIdentifier(teamId);
      
      if (teamName) {
        cacheTeamName(teamUUID, captainPubkey, teamName);
      }
      
      this.setState({ defaultPostingTeam: teamId });
      
      return new AgentResponse({
        success: true,
        data: { defaultTeam: teamId, teamName }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to set default team: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Get default posting team
   */
  getDefaultPostingTeam() {
    return new AgentResponse({
      success: true,
      data: { defaultTeam: this.defaultPostingTeam }
    });
  }

  /**
   * Send chat message to team
   */
  async sendChatMessage(payload) {
    const { teamUUID, captainPubkey, message } = payload;
    
    if (!message || message.trim().length === 0) {
      throw new AgentError('Message content is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const chatEvent = {
        kind: 9, // NIP-29 group chat message
        content: message.trim(),
        tags: [
          ['h', teamUUID],
          ['p', captainPubkey]
        ]
      };
      
      const response = await this.sendMessage('CoreServices', 'nostr.publish', {
        event: chatEvent
      });
      
      if (!response.success) {
        throw new AgentError('Failed to send message', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          messageId: response.data.eventId,
          sent: true 
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to send chat message: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get chat history for team
   */
  async getChatHistory(payload) {
    const { teamUUID, captainPubkey, limit = 50 } = payload;
    
    try {
      const response = await this.sendMessage('CoreServices', 'nostr.fetch', {
        filter: {
          kinds: [9], // Group chat messages
          '#h': [teamUUID],
          '#p': [captainPubkey],
          limit
        }
      });
      
      if (!response.success) {
        throw new AgentError('Failed to fetch chat history', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Sort messages by creation time
      const messages = response.data
        .sort((a, b) => a.created_at - b.created_at)
        .map(event => ({
          id: event.id,
          content: event.content,
          author: event.pubkey,
          timestamp: event.created_at * 1000,
          tags: event.tags
        }));
      
      return new AgentResponse({
        success: true,
        data: { messages }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get chat history: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Load user's teams
   */
  async loadUserTeams() {
    try {
      const coreResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
      
      if (!coreResponse.success || !coreResponse.data.isAuthenticated) {
        return;
      }
      
      // Import teams service
      const { fetchUserMemberTeams } = await import('../services/nostr/NostrTeamsService.js');
      
      // This would need to be adapted to work with the agent system
      // For now, keeping the existing implementation pattern
      const { ndkSingleton } = await import('../lib/ndkSingleton.js');
      const ndk = await ndkSingleton;
      
      if (ndk) {
        const memberTeams = await fetchUserMemberTeams(ndk, coreResponse.data.publicKey);
        this.userTeams = memberTeams;
        
        // Load default posting team from settings
        const { getDefaultPostingTeamIdentifier } = await import('../utils/settingsManager.js');
        this.defaultPostingTeam = getDefaultPostingTeamIdentifier();
        
        this.setState({
          userTeams: this.userTeams,
          defaultPostingTeam: this.defaultPostingTeam
        });
      }
      
    } catch (error) {
      console.error('Failed to load user teams:', error);
    }
  }

  /**
   * Parse team event from Nostr
   */
  parseTeamEvent(event) {
    try {
      const content = JSON.parse(event.content || '{}');
      const dTag = event.tags.find(tag => tag[0] === 'd');
      const nameTag = event.tags.find(tag => tag[0] === 'name');
      const aboutTag = event.tags.find(tag => tag[0] === 'about');
      const publicTag = event.tags.find(tag => tag[0] === 'public');
      
      return {
        id: event.id,
        uuid: dTag?.[1],
        name: nameTag?.[1] || content.name || 'Unnamed Team',
        description: aboutTag?.[1] || content.about || '',
        isPublic: publicTag?.[1] === 'true',
        captainPubkey: event.pubkey,
        createdAt: new Date(event.created_at * 1000).toISOString(),
        rules: content.rules || []
      };
    } catch (error) {
      console.error('Failed to parse team event:', error);
      return null;
    }
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    await this.loadUserTeams();
  }

  /**
   * Handle user logout
   */
  async handleUserLogout(message) {
    this.userTeams = [];
    this.defaultPostingTeam = null;
    this.currentTeam = null;
    
    this.setState({
      userTeams: [],
      defaultPostingTeam: null,
      currentTeam: null
    });
  }

  /**
   * Handle team updates
   */
  async handleTeamUpdate(message) {
    // Refresh user teams when team data changes
    await this.loadUserTeams();
  }
}