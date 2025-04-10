/**
 * TeamsDataService.js
 * Centralized service for handling teams/clubs data
 */

import nip29Bridge from './NIP29Bridge';
import { getUserPublicKey } from '../utils/nostrClient';

class TeamsDataService {
  constructor() {
    this.teamsStorageKey = 'teamsData';
    this.membershipStorageKey = 'teamMemberships';
    this.teamMessagesKey = 'teamMessages';
    this.teamChallengesKey = 'teamChallenges';
    this.pinnedPostsKey = 'teamPinnedPosts';
    this.listeners = [];
    
    // Nostr integration state
    this.isNip29Initialized = false;
    this.nostrEnabled = localStorage.getItem('nostr_groups_enabled') === 'true';
    
    // Initialize Nostr bridge if enabled
    if (this.nostrEnabled) {
      this._initializeNostrBridge();
    }
  }
  
  /**
   * Initialize the Nostr bridge for NIP29 group synchronization
   * @private
   */
  async _initializeNostrBridge() {
    try {
      if (this.isNip29Initialized) return;
      
      // Initialize the NIP29 bridge
      const success = await nip29Bridge.initialize();
      
      if (success) {
        this.isNip29Initialized = true;
        
        // Add listener for incoming Nostr messages
        nip29Bridge.addListener(this._handleNostrEvent.bind(this));
        
        console.log('NIP29 bridge initialized successfully');
      } else {
        console.warn('Failed to initialize NIP29 bridge');
      }
    } catch (error) {
      console.error('Error initializing NIP29 bridge:', error);
    }
  }
  
  /**
   * Handle events from the Nostr bridge
   * @param {string} eventType - Type of Nostr event
   * @param {Object} data - Event data
   * @private
   */
  _handleNostrEvent(eventType, data) {
    try {
      if (eventType === 'incoming_message' || eventType === 'sync_message') {
        const { clubId, event } = data;
        
        // Handle incoming message from Nostr
        if (clubId && event) {
          // Check if we already have this message (prevent duplicates)
          const allMessages = this.getTeamMessages(clubId);
          const nostrMessageId = `nostr:${event.id}`;
          
          // Check if we already have this message
          if (!allMessages.some(msg => msg.id === nostrMessageId)) {
            // Add the message to our local storage
            this._addNostrMessageToClub(clubId, event);
          }
        }
      }
    } catch (error) {
      console.error('Error handling Nostr event:', error);
    }
  }
  
  /**
   * Add a message from Nostr to the local club storage
   * @param {string} clubId - Club ID
   * @param {Object} nostrEvent - Nostr event
   * @private
   */
  _addNostrMessageToClub(clubId, nostrEvent) {
    try {
      const messages = this.getTeamMessages(clubId);
      
      const newMessage = {
        id: `nostr:${nostrEvent.id}`,
        teamId: clubId,
        userId: nostrEvent.pubkey,
        content: nostrEvent.content,
        timestamp: new Date(nostrEvent.created_at * 1000).toISOString(),
        fromNostr: true,
        nostrEventId: nostrEvent.id
      };
      
      const allMessages = localStorage.getItem(this.teamMessagesKey);
      const allMessagesParsed = allMessages ? JSON.parse(allMessages) : [];
      
      const updatedMessages = [...allMessagesParsed.filter(m => m.teamId !== clubId), ...messages, newMessage];
      localStorage.setItem(this.teamMessagesKey, JSON.stringify(updatedMessages));
      
      // Notify listeners
      this.notifyListeners('messages', updatedMessages);
    } catch (error) {
      console.error('Error adding Nostr message to club:', error);
    }
  }

  /**
   * Get all teams from storage
   * @returns {Array} Array of team objects
   */
  getAllTeams() {
    try {
      const storedTeams = localStorage.getItem(this.teamsStorageKey);
      return storedTeams ? JSON.parse(storedTeams) : [];
    } catch (error) {
      console.error('Error loading teams data:', error);
      return [];
    }
  }

  /**
   * Get a specific team by ID
   * @param {string} teamId - Team ID to retrieve
   * @returns {Object|null} Team object or null if not found
   */
  getTeamById(teamId) {
    try {
      const teams = this.getAllTeams();
      return teams.find(team => team.id === teamId) || null;
    } catch (error) {
      console.error('Error retrieving team:', error);
      return null;
    }
  }

  /**
   * Create a new team
   * @param {Object} teamData - Team data to save
   * @returns {Object} The saved team with generated ID
   */
  async createTeam(teamData) {
    try {
      const teams = this.getAllTeams();
      
      // Generate a unique ID if not provided
      const newTeam = {
        id: teamData.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        createdAt: teamData.createdAt || new Date().toISOString(),
        members: teamData.members || [],
        ...teamData,
        hasNostrGroup: false // Add Nostr group status field
      };
      
      // Add to teams array
      const updatedTeams = [...teams, newTeam];
      localStorage.setItem(this.teamsStorageKey, JSON.stringify(updatedTeams));
      
      // If Nostr integration is enabled, create a NIP29 group
      if (this.nostrEnabled && this.isNip29Initialized) {
        try {
          // Create Nostr group
          const groupData = await nip29Bridge.createGroupForClub(newTeam);
          
          if (groupData) {
            // Update team with Nostr group ID
            newTeam.hasNostrGroup = true;
            newTeam.nostrGroupId = groupData.groupId;
            
            // Update in storage
            const updatedTeamsWithNostr = updatedTeams.map(t => 
              t.id === newTeam.id ? newTeam : t
            );
            
            localStorage.setItem(this.teamsStorageKey, JSON.stringify(updatedTeamsWithNostr));
            
            // Notify listeners of the update
            this.notifyListeners('teams', updatedTeamsWithNostr);
          }
        } catch (error) {
          console.error('Error creating Nostr group for team:', error);
          // Continue with centralized team creation even if Nostr fails
        }
      }
      
      // Notify listeners
      this.notifyListeners('teams', updatedTeams);
      
      return newTeam;
    } catch (error) {
      console.error('Error creating team:', error);
      return null;
    }
  }

  /**
   * Update an existing team
   * @param {string} teamId - ID of the team to update
   * @param {Object} updatedData - New data to apply
   * @returns {boolean} Success status
   */
  updateTeam(teamId, updatedData) {
    try {
      const teams = this.getAllTeams();
      const index = teams.findIndex(team => team.id === teamId);
      
      if (index === -1) return false;
      
      // Update the team
      teams[index] = { ...teams[index], ...updatedData };
      localStorage.setItem(this.teamsStorageKey, JSON.stringify(teams));
      
      // Notify listeners
      this.notifyListeners('teams', teams);
      
      return true;
    } catch (error) {
      console.error('Error updating team:', error);
      return false;
    }
  }

  /**
   * Delete a team
   * @param {string} teamId - ID of the team to delete
   * @returns {boolean} Success status
   */
  deleteTeam(teamId) {
    try {
      const teams = this.getAllTeams();
      const updatedTeams = teams.filter(team => team.id !== teamId);
      
      if (updatedTeams.length === teams.length) return false;
      
      localStorage.setItem(this.teamsStorageKey, JSON.stringify(updatedTeams));
      
      // Notify listeners
      this.notifyListeners('teams', updatedTeams);
      
      return true;
    } catch (error) {
      console.error('Error deleting team:', error);
      return false;
    }
  }

  /**
   * Get teams that a user is a member of
   * @param {string} userId - User ID to check membership for
   * @returns {Array} Array of team objects the user is a member of
   */
  getUserTeams(userId) {
    try {
      const memberships = this.getMemberships();
      const userMemberships = memberships.filter(m => m.userId === userId);
      const teams = this.getAllTeams();
      
      return teams.filter(team => 
        userMemberships.some(membership => membership.teamId === team.id)
      );
    } catch (error) {
      console.error('Error getting user teams:', error);
      return [];
    }
  }

  /**
   * Get all memberships or memberships for a specific team
   * @param {string} teamId - Optional team ID to filter memberships
   * @returns {Array} Array of membership objects
   */
  getMemberships(teamId = null) {
    try {
      const storedMemberships = localStorage.getItem(this.membershipStorageKey);
      const memberships = storedMemberships ? JSON.parse(storedMemberships) : [];
      
      if (teamId) {
        return memberships.filter(membership => membership.teamId === teamId);
      }
      
      return memberships;
    } catch (error) {
      console.error('Error loading membership data:', error);
      return [];
    }
  }

  /**
   * Add a user to a team
   * @param {string} teamId - Team ID to join
   * @param {string} userId - User ID to add
   * @param {string} role - Role of the user in the team (member, admin)
   * @returns {boolean} Success status
   */
  async addMember(teamId, userId, role = 'member') {
    try {
      const memberships = this.getMemberships();
      
      // Check if already a member
      if (memberships.some(m => m.teamId === teamId && m.userId === userId)) {
        return false;
      }
      
      // Add to memberships
      const newMembership = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        teamId,
        userId,
        role,
        joinedAt: new Date().toISOString()
      };
      
      const updatedMemberships = [...memberships, newMembership];
      localStorage.setItem(this.membershipStorageKey, JSON.stringify(updatedMemberships));
      
      // Update team members count
      const team = this.getTeamById(teamId);
      if (team) {
        this.updateTeam(teamId, { 
          memberCount: (team.memberCount || 0) + 1
        });
      }
      
      // If Nostr integration is enabled and the team has a Nostr group, add user to the group
      if (this.nostrEnabled && this.isNip29Initialized && team && team.hasNostrGroup) {
        try {
          // Get user's Nostr pubkey
          const userPubkey = await getUserPublicKey();
          
          if (userPubkey) {
            // Add user to Nostr group
            await nip29Bridge.addUserToGroup(teamId, userPubkey);
          }
        } catch (error) {
          console.error('Error adding user to Nostr group:', error);
          // Continue with centralized membership even if Nostr fails
        }
      }
      
      // Notify listeners
      this.notifyListeners('memberships', updatedMemberships);
      
      return true;
    } catch (error) {
      console.error('Error adding team member:', error);
      return false;
    }
  }

  /**
   * Remove a user from a team
   * @param {string} teamId - Team ID 
   * @param {string} userId - User ID to remove
   * @returns {boolean} Success status
   */
  removeMember(teamId, userId) {
    try {
      const memberships = this.getMemberships();
      const updatedMemberships = memberships.filter(
        m => !(m.teamId === teamId && m.userId === userId)
      );
      
      if (updatedMemberships.length === memberships.length) return false;
      
      localStorage.setItem(this.membershipStorageKey, JSON.stringify(updatedMemberships));
      
      // Update team members count
      const team = this.getTeamById(teamId);
      if (team) {
        this.updateTeam(teamId, { 
          memberCount: Math.max(0, (team.memberCount || 0) - 1)
        });
      }
      
      // Notify listeners
      this.notifyListeners('memberships', updatedMemberships);
      
      return true;
    } catch (error) {
      console.error('Error removing team member:', error);
      return false;
    }
  }

  /**
   * Get team messages
   * @param {string} teamId - Team ID to get messages for
   * @returns {Array} Array of message objects for the team
   */
  getTeamMessages(teamId) {
    try {
      const storedMessages = localStorage.getItem(this.teamMessagesKey);
      const messages = storedMessages ? JSON.parse(storedMessages) : [];
      
      return messages.filter(message => message.teamId === teamId);
    } catch (error) {
      console.error('Error loading team messages:', error);
      return [];
    }
  }

  /**
   * Add a message to a team chat
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID who sent the message
   * @param {string} content - Message content
   * @returns {Object} The created message object
   */
  async addTeamMessage(teamId, userId, content) {
    try {
      const messages = this.getTeamMessages(teamId);
      
      const newMessage = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        teamId,
        userId,
        content,
        timestamp: new Date().toISOString()
      };
      
      const allMessages = localStorage.getItem(this.teamMessagesKey);
      const allMessagesParsed = allMessages ? JSON.parse(allMessages) : [];
      
      const updatedMessages = [...allMessagesParsed.filter(m => m.teamId !== teamId), ...messages, newMessage];
      localStorage.setItem(this.teamMessagesKey, JSON.stringify(updatedMessages));
      
      // If Nostr integration is enabled and the team has a Nostr group, send message to the group
      const team = this.getTeamById(teamId);
      if (this.nostrEnabled && this.isNip29Initialized && team && team.hasNostrGroup) {
        try {
          // Get user's Nostr pubkey
          const userPubkey = await getUserPublicKey();
          
          if (userPubkey) {
            // Send message to Nostr group
            await nip29Bridge.sendMessageToGroup(teamId, content, userPubkey);
          }
        } catch (error) {
          console.error('Error sending message to Nostr group:', error);
          // Continue with centralized message even if Nostr fails
        }
      }
      
      // Notify listeners
      this.notifyListeners('messages', updatedMessages);
      
      return newMessage;
    } catch (error) {
      console.error('Error adding team message:', error);
      return null;
    }
  }

  /**
   * Get pinned posts for a team
   * @param {string} teamId - Team ID to get pinned posts for
   * @returns {Array} Array of pinned post objects
   */
  getPinnedPosts(teamId) {
    try {
      const storedPosts = localStorage.getItem(this.pinnedPostsKey);
      const posts = storedPosts ? JSON.parse(storedPosts) : [];
      
      return posts.filter(post => post.teamId === teamId);
    } catch (error) {
      console.error('Error loading pinned posts:', error);
      return [];
    }
  }

  /**
   * Pin a post in a team
   * @param {string} teamId - Team ID
   * @param {Object} postData - Post data to pin
   * @returns {Object} The pinned post object
   */
  pinPost(teamId, postData) {
    try {
      const pinnedPosts = this.getPinnedPosts(teamId);
      
      const newPin = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        teamId,
        ...postData,
        pinnedAt: new Date().toISOString()
      };
      
      const allPins = localStorage.getItem(this.pinnedPostsKey);
      const allPinsParsed = allPins ? JSON.parse(allPins) : [];
      
      const updatedPins = [...allPinsParsed.filter(p => p.teamId !== teamId), ...pinnedPosts, newPin];
      localStorage.setItem(this.pinnedPostsKey, JSON.stringify(updatedPins));
      
      // Notify listeners
      this.notifyListeners('pinnedPosts', updatedPins);
      
      return newPin;
    } catch (error) {
      console.error('Error pinning post:', error);
      return null;
    }
  }

  /**
   * Unpin a post from a team
   * @param {string} teamId - Team ID
   * @param {string} postId - ID of the post to unpin
   * @returns {boolean} Success status
   */
  unpinPost(teamId, postId) {
    try {
      const allPins = localStorage.getItem(this.pinnedPostsKey);
      const allPinsParsed = allPins ? JSON.parse(allPins) : [];
      
      const updatedPins = allPinsParsed.filter(
        pin => !(pin.teamId === teamId && pin.id === postId)
      );
      
      if (updatedPins.length === allPinsParsed.length) return false;
      
      localStorage.setItem(this.pinnedPostsKey, JSON.stringify(updatedPins));
      
      // Notify listeners
      this.notifyListeners('pinnedPosts', updatedPins);
      
      return true;
    } catch (error) {
      console.error('Error unpinning post:', error);
      return false;
    }
  }

  /**
   * Get team challenges
   * @param {string} teamId - Team ID to get challenges for
   * @returns {Array} Array of challenge objects for the team
   */
  getTeamChallenges(teamId) {
    try {
      const storedChallenges = localStorage.getItem(this.teamChallengesKey);
      const challenges = storedChallenges ? JSON.parse(storedChallenges) : [];
      
      return challenges.filter(challenge => challenge.teamId === teamId);
    } catch (error) {
      console.error('Error loading team challenges:', error);
      return [];
    }
  }

  /**
   * Create a challenge for a team
   * @param {string} teamId - Team ID
   * @param {Object} challengeData - Challenge data
   * @returns {Object} The created challenge object
   */
  createChallenge(teamId, challengeData) {
    try {
      const challenges = this.getTeamChallenges(teamId);
      
      const newChallenge = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        teamId,
        ...challengeData,
        createdAt: new Date().toISOString(),
        participants: []
      };
      
      const allChallenges = localStorage.getItem(this.teamChallengesKey);
      const allChallengesParsed = allChallenges ? JSON.parse(allChallenges) : [];
      
      const updatedChallenges = [...allChallengesParsed.filter(c => c.teamId !== teamId), ...challenges, newChallenge];
      localStorage.setItem(this.teamChallengesKey, JSON.stringify(updatedChallenges));
      
      // Notify listeners
      this.notifyListeners('challenges', updatedChallenges);
      
      return newChallenge;
    } catch (error) {
      console.error('Error creating challenge:', error);
      return null;
    }
  }

  /**
   * Join a challenge
   * @param {string} challengeId - Challenge ID to join
   * @param {string} userId - User ID who is joining
   * @returns {boolean} Success status
   */
  joinChallenge(challengeId, userId) {
    try {
      const allChallenges = localStorage.getItem(this.teamChallengesKey);
      const allChallengesParsed = allChallenges ? JSON.parse(allChallenges) : [];
      
      const challengeIndex = allChallengesParsed.findIndex(c => c.id === challengeId);
      
      if (challengeIndex === -1) return false;
      
      // Check if already participating
      if (allChallengesParsed[challengeIndex].participants.includes(userId)) {
        return false;
      }
      
      // Add user to participants
      allChallengesParsed[challengeIndex].participants.push(userId);
      
      localStorage.setItem(this.teamChallengesKey, JSON.stringify(allChallengesParsed));
      
      // Notify listeners
      this.notifyListeners('challenges', allChallengesParsed);
      
      return true;
    } catch (error) {
      console.error('Error joining challenge:', error);
      return false;
    }
  }

  /**
   * Leave a challenge
   * @param {string} challengeId - Challenge ID to leave
   * @param {string} userId - User ID who is leaving
   * @returns {boolean} Success status
   */
  leaveChallenge(challengeId, userId) {
    try {
      const allChallenges = localStorage.getItem(this.teamChallengesKey);
      const allChallengesParsed = allChallenges ? JSON.parse(allChallenges) : [];
      
      const challengeIndex = allChallengesParsed.findIndex(c => c.id === challengeId);
      
      if (challengeIndex === -1) return false;
      
      // Remove user from participants
      allChallengesParsed[challengeIndex].participants = 
        allChallengesParsed[challengeIndex].participants.filter(id => id !== userId);
      
      localStorage.setItem(this.teamChallengesKey, JSON.stringify(allChallengesParsed));
      
      // Notify listeners
      this.notifyListeners('challenges', allChallengesParsed);
      
      return true;
    } catch (error) {
      console.error('Error leaving challenge:', error);
      return false;
    }
  }

  /**
   * Add a listener for team data changes
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of changes
   * @param {string} dataType - Type of data that changed
   * @param {Array} data - Updated data array
   */
  notifyListeners(dataType, data) {
    this.listeners.forEach(listener => {
      try {
        listener(dataType, data);
      } catch (error) {
        console.error('Error in team data listener:', error);
      }
    });
  }

  /**
   * Initialize sample data for demonstration purposes
   */
  initializeSampleData() {
    // Don't initialize any sample data
    return;
  }

  /**
   * Enable or disable Nostr integration
   * @param {boolean} enabled - Whether Nostr integration should be enabled
   */
  setNostrIntegration(enabled) {
    try {
      this.nostrEnabled = enabled;
      localStorage.setItem('nostr_groups_enabled', enabled ? 'true' : 'false');
      
      if (enabled && !this.isNip29Initialized) {
        this._initializeNostrBridge();
      }
    } catch (error) {
      console.error('Error setting Nostr integration:', error);
    }
  }

  /**
   * Check if Nostr integration is enabled
   * @returns {boolean} Whether Nostr integration is enabled
   */
  isNostrIntegrationEnabled() {
    return this.nostrEnabled;
  }

  initialize() {
    // Clear all demo data first
    this.clearAllDemoData();
    
    // Initialize empty storage if not exists
    if (!localStorage.getItem(this.teamsStorageKey)) {
      localStorage.setItem(this.teamsStorageKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.membershipStorageKey)) {
      localStorage.setItem(this.membershipStorageKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.teamMessagesKey)) {
      localStorage.setItem(this.teamMessagesKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.pinnedPostsKey)) {
      localStorage.setItem(this.pinnedPostsKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.teamChallengesKey)) {
      localStorage.setItem(this.teamChallengesKey, JSON.stringify([]));
    }
  }

  /**
   * Clear all demo data from localStorage
   */
  clearAllDemoData() {
    // Force clear any existing data to remove demos
    localStorage.removeItem(this.teamsStorageKey);
    localStorage.removeItem(this.membershipStorageKey);
    localStorage.removeItem(this.teamMessagesKey);
    localStorage.removeItem(this.pinnedPostsKey);
    localStorage.removeItem(this.teamChallengesKey);
    
    console.log('All demo team data has been cleared');
  }
}

// Create and export singleton instance
const teamsDataService = new TeamsDataService();

// Initialize sample data
teamsDataService.initializeSampleData();

export default teamsDataService; 