import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import teamsDataService from '../services/TeamsDataService';

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

export function TeamsProvider({ children }) {
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

  // Load teams data initially
  useEffect(() => {
    const loadTeamsData = () => {
      try {
        const allTeams = teamsDataService.getAllTeams();
        setTeams(allTeams);
        
        if (currentUser) {
          const userTeams = teamsDataService.getUserTeams(currentUser);
          setMyTeams(userTeams);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading teams data:', error);
        setError('Failed to load teams data. Please try again later.');
        setLoading(false);
      }
    };
    
    loadTeamsData();
    
    // Add listener for data changes
    teamsDataService.addListener(handleDataChange);
    
    // Cleanup
    return () => {
      teamsDataService.removeListener(handleDataChange);
    };
  }, [currentUser]);

  // Handle data changes from service
  const handleDataChange = useCallback((dataType, data) => {
    switch (dataType) {
      case 'teams':
        setTeams(data);
        if (currentUser) {
          const userTeams = teamsDataService.getUserTeams(currentUser);
          setMyTeams(userTeams);
        }
        break;
      case 'memberships':
        if (currentUser) {
          const userTeams = teamsDataService.getUserTeams(currentUser);
          setMyTeams(userTeams);
        }
        if (selectedTeam) {
          const members = teamsDataService.getMemberships(selectedTeam.id);
          setTeamMembers(members);
        }
        break;
      case 'messages':
        if (selectedTeam) {
          const messages = teamsDataService.getTeamMessages(selectedTeam.id);
          setTeamMessages(messages);
        }
        break;
      case 'challenges':
        if (selectedTeam) {
          const challenges = teamsDataService.getTeamChallenges(selectedTeam.id);
          setTeamChallenges(challenges);
        }
        break;
      case 'pinnedPosts':
        if (selectedTeam) {
          const pinned = teamsDataService.getPinnedPosts(selectedTeam.id);
          setPinnedPosts(pinned);
        }
        break;
      default:
        break;
    }
  }, [currentUser, selectedTeam]);

  // Select a team
  const selectTeam = useCallback((teamId) => {
    try {
      setLoading(true);
      const team = teamsDataService.getTeamById(teamId);
      
      if (team) {
        setSelectedTeam(team);
        
        // Load related data
        const messages = teamsDataService.getTeamMessages(teamId);
        setTeamMessages(messages);
        
        const members = teamsDataService.getMemberships(teamId);
        setTeamMembers(members);
        
        const challenges = teamsDataService.getTeamChallenges(teamId);
        setTeamChallenges(challenges);
        
        const pinned = teamsDataService.getPinnedPosts(teamId);
        setPinnedPosts(pinned);
      } else {
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
  const createTeam = useCallback((teamData) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to create a team');
      }
      
      const newTeam = teamsDataService.createTeam({
        ...teamData,
        creatorId: currentUser,
      });
      
      if (newTeam) {
        // Add creator as admin
        teamsDataService.addMember(newTeam.id, currentUser, 'admin');
        return newTeam;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating team:', error);
      setError(error.message || 'Failed to create team');
      return null;
    }
  }, [currentUser]);

  // Join a team
  const joinTeam = useCallback((teamId) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to join a team');
      }
      
      const success = teamsDataService.addMember(teamId, currentUser);
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
  const sendMessage = useCallback((teamId, content) => {
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to send a message');
      }
      
      const message = teamsDataService.addTeamMessage(teamId, currentUser, content);
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
    selectTeam,
    createTeam,
    joinTeam,
    leaveTeam,
    sendMessage,
    pinPost,
    createChallenge,
    joinChallenge,
    setUser,
    clearError
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