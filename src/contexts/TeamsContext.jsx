import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import teamsDataService from '../services/TeamsDataService';
import { NostrContext } from './NostrContext';
import { getUserPublicKey } from '../utils/nostrClient';

// Create context
export const TeamsContext = createContext();

// Custom hook for using Teams context
export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
};

export const TeamsProvider = ({ children }) => {
  // Get Nostr context
  const { publicKey: nostrPublicKey } = useContext(NostrContext);
  
  // Teams state
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamChallenges, setTeamChallenges] = useState([]);
  const [pinnedPosts, setPinnedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('currentUser') || null;
  });
  
  // Nostr integration state
  const [nostrIntegrationEnabled, setNostrIntegrationEnabled] = useState(() => {
    return teamsDataService.isNostrIntegrationEnabled();
  });

  // Use Nostr public key as current user if available
  useEffect(() => {
    const syncNostrUser = async () => {
      if (nostrPublicKey) {
        // If we have a Nostr public key, use it as the current user
        setCurrentUser(nostrPublicKey);
        localStorage.setItem('currentUser', nostrPublicKey);
      }
    };
    
    syncNostrUser();
  }, [nostrPublicKey]);

  // Define the fetchTeams function
  const fetchTeams = useCallback(() => {
    try {
      const allTeams = teamsDataService.getAllTeams();
      setTeams(allTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
    }
  }, []);

  // Define the fetchMyTeams function
  const fetchMyTeams = useCallback(() => {
    if (currentUser) {
      try {
        const userTeams = teamsDataService.getUserTeams(currentUser);
        console.log('Fetched user teams:', userTeams);
        setMyTeams(userTeams);
      } catch (err) {
        console.error('Error fetching user teams:', err);
        setError('Failed to load your teams');
      }
    } else {
      setMyTeams([]);
    }
  }, [currentUser]);
  
  // Initialize the context
  useEffect(() => {
    // Clear any existing demo data
    const teamsStorageKey = 'runstr_teams';
    const membershipStorageKey = 'runstr_team_memberships';
    const teamMessagesKey = 'runstr_team_messages';
    const pinnedPostsKey = 'runstr_pinned_posts';
    const teamChallengesKey = 'runstr_team_challenges';
    
    // Check if this is the first run after update to remove demo data
    const demoRemoved = localStorage.getItem('runstr_demo_removed');
    if (!demoRemoved) {
      localStorage.removeItem(teamsStorageKey);
      localStorage.removeItem(membershipStorageKey);
      localStorage.removeItem(teamMessagesKey);
      localStorage.removeItem(pinnedPostsKey);
      localStorage.removeItem(teamChallengesKey);
      localStorage.setItem('runstr_demo_removed', 'true');
    }
    
    // Initialize the services
    teamsDataService.initialize();
    
    // Load initial data
    fetchTeams();
    fetchMyTeams();
    
    // Add event listeners
    teamsDataService.addListener('teams', fetchTeams);
    teamsDataService.addListener('myTeams', fetchMyTeams);
    teamsDataService.addListener('error', (error) => setError(error));
    
    return () => {
      // Remove event listeners on cleanup
      teamsDataService.removeListener('teams', fetchTeams);
      teamsDataService.removeListener('myTeams', fetchMyTeams);
      teamsDataService.removeListener('error', (error) => setError(error));
    };
  }, [currentUser, fetchTeams, fetchMyTeams]); // Re-initialize when user changes

  // Select a team
  const selectTeam = useCallback((teamId) => {
    try {
      setLoading(true);
      console.log(`Selecting team: ${teamId}`);
      
      const team = teamsDataService.getTeamById(teamId);
      
      if (team) {
        console.log('Team found:', team);
        setSelectedTeam(team);
        
        // Load related data
        const messages = teamsDataService.getTeamMessages(teamId);
        console.log(`Loaded ${messages.length} messages for team`);
        setTeamMessages(messages);
        
        const members = teamsDataService.getMemberships(teamId);
        console.log(`Loaded ${members.length} members for team`);
        setTeamMembers(members);
        
        const challenges = teamsDataService.getTeamChallenges(teamId);
        console.log(`Loaded ${challenges.length} challenges for team`);
        setTeamChallenges(challenges);
        
        const pinned = teamsDataService.getPinnedPosts(teamId);
        console.log(`Loaded ${pinned.length} pinned posts for team`);
        setPinnedPosts(pinned);
      } else {
        console.error('Team not found with ID:', teamId);
        setError('Team not found');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error selecting team:', error);
      setError('Failed to load team details. Please try again later.');
      setLoading(false);
    }
  }, []);

  // Create a team
  const createTeam = useCallback(async (teamData) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to create a team');
      }
      
      // Check if Nostr authentication is required
      const userPubkey = await getUserPublicKey();
      if (nostrIntegrationEnabled && !userPubkey) {
        throw new Error('Nostr authentication is required to create a club with Nostr integration');
      }
      
      console.log('Creating team with data:', { ...teamData, creatorId: currentUser });
      
      const newTeam = await teamsDataService.createTeam({
        ...teamData,
        creatorId: currentUser,
      });
      
      if (newTeam) {
        console.log('Team created successfully:', newTeam);
        
        // Add creator as admin
        const memberAdded = await teamsDataService.addMember(newTeam.id, currentUser, 'admin');
        console.log('Creator added as admin:', memberAdded);
        
        if (!memberAdded) {
          console.error('Failed to add creator as admin');
        }
        
        // Explicitly reload my teams to ensure UI updates
        fetchMyTeams();
        
        return newTeam;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating team:', error);
      setError(error.message || 'Failed to create team');
      return null;
    }
  }, [currentUser, nostrIntegrationEnabled, fetchMyTeams]);

  // Join a team
  const joinTeam = useCallback(async (teamId) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to join a team');
      }
      
      // Check if Nostr authentication is required for teams with Nostr groups
      const team = teamsDataService.getTeamById(teamId);
      if (team && team.hasNostrGroup) {
        const userPubkey = await getUserPublicKey();
        if (!userPubkey) {
          throw new Error('Nostr authentication is required to join this club');
        }
      }
      
      const success = await teamsDataService.addMember(teamId, currentUser);
      return success;
    } catch (error) {
      console.error('Error joining team:', error);
      setError(error.message || 'Failed to join team');
      return false;
    }
  }, [currentUser]);

  // Leave a team
  const leaveTeam = useCallback((teamId) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to leave a team');
      }
      
      const success = teamsDataService.removeMember(teamId, currentUser);
      
      // If leaving the currently selected team, clear selection
      if (success && selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam(null);
        setTeamMessages([]);
        setTeamMembers([]);
        setTeamChallenges([]);
        setPinnedPosts([]);
      }
      
      return success;
    } catch (error) {
      console.error('Error leaving team:', error);
      setError(error.message || 'Failed to leave team');
      return false;
    }
  }, [currentUser, selectedTeam]);

  // Send message to team chat
  const sendMessage = useCallback(async (teamId, content) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to send a message');
      }
      
      // Check if Nostr authentication is required for teams with Nostr groups
      const team = teamsDataService.getTeamById(teamId);
      if (team && team.hasNostrGroup) {
        const userPubkey = await getUserPublicKey();
        if (!userPubkey) {
          throw new Error('Nostr authentication is required to send messages in this club');
        }
      }
      
      const message = await teamsDataService.addTeamMessage(teamId, currentUser, content);
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
      return null;
    }
  }, [currentUser]);

  // Pin a post
  const pinPost = useCallback((teamId, postData) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to pin a post');
      }
      
      // Check if user is an admin
      const memberships = teamsDataService.getMemberships(teamId);
      const userMembership = memberships.find(m => m.userId === currentUser);
      
      if (!userMembership || userMembership.role !== 'admin') {
        throw new Error('Only team admins can pin posts');
      }
      
      const pin = teamsDataService.pinPost(teamId, postData);
      return pin;
    } catch (error) {
      console.error('Error pinning post:', error);
      setError(error.message || 'Failed to pin post');
      return null;
    }
  }, [currentUser]);

  // Create a team challenge
  const createChallenge = useCallback((teamId, challengeData) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to create a challenge');
      }
      
      // Check if user is an admin
      const memberships = teamsDataService.getMemberships(teamId);
      const userMembership = memberships.find(m => m.userId === currentUser);
      
      if (!userMembership || userMembership.role !== 'admin') {
        throw new Error('Only team admins can create challenges');
      }
      
      const challenge = teamsDataService.createChallenge(teamId, {
        ...challengeData,
        creatorId: currentUser
      });
      
      return challenge;
    } catch (error) {
      console.error('Error creating challenge:', error);
      setError(error.message || 'Failed to create challenge');
      return null;
    }
  }, [currentUser]);

  // Join a challenge
  const joinChallenge = useCallback((challengeId) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to join a challenge');
      }
      
      const success = teamsDataService.joinChallenge(challengeId, currentUser);
      return success;
    } catch (error) {
      console.error('Error joining challenge:', error);
      setError(error.message || 'Failed to join challenge');
      return false;
    }
  }, [currentUser]);

  // Set current user
  const setUser = useCallback((userId) => {
    setCurrentUser(userId);
    localStorage.setItem('currentUser', userId);
    
    // Update user-specific data
    if (userId) {
      const userTeams = teamsDataService.getUserTeams(userId);
      setMyTeams(userTeams);
    } else {
      setMyTeams([]);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Toggle Nostr integration
  const toggleNostrIntegration = useCallback((enabled) => {
    try {
      teamsDataService.setNostrIntegration(enabled);
      setNostrIntegrationEnabled(enabled);
    } catch (error) {
      console.error('Error toggling Nostr integration:', error);
      setError('Failed to update Nostr integration settings');
    }
  }, []);

  // Context value
  const value = {
    teams,
    myTeams,
    selectedTeam,
    teamMessages,
    teamMembers,
    teamChallenges,
    pinnedPosts,
    loading,
    error,
    currentUser,
    nostrIntegrationEnabled,
    selectTeam,
    createTeam,
    joinTeam,
    leaveTeam,
    sendMessage,
    pinPost,
    createChallenge,
    joinChallenge,
    setUser,
    clearError,
    toggleNostrIntegration
  };

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
}

TeamsProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 