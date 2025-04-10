import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTeams } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';

export const TeamDetail = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { 
    selectedTeam,
    teamMessages,
    teamMembers,
    teamChallenges,
    pinnedPosts,
    loading,
    error, 
    currentUser,
    selectTeam,
    joinTeam,
    leaveTeam,
    sendMessage,
    joinChallenge,
    clearError
  } = useTeams();
  
  const { publicKey } = useContext(NostrContext);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [messageText, setMessageText] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const chatEndRef = useRef(null);
  
  // Load team data when component mounts or teamId changes
  useEffect(() => {
    if (teamId) {
      selectTeam(teamId);
    }
    
    // Reset active tab when changing teams
    setActiveTab('overview');
  }, [teamId, selectTeam]);
  
  // Check if current user is a member/admin when selectedTeam or teamMembers changes
  useEffect(() => {
    if (currentUser && teamMembers && teamMembers.length > 0) {
      const membership = teamMembers.find(m => m.userId === currentUser);
      setIsMember(!!membership);
      setIsAdmin(membership?.role === 'admin');
    } else {
      setIsMember(false);
      setIsAdmin(false);
    }
  }, [currentUser, teamMembers]);
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [teamMessages, activeTab]);
  
  // Handle joining a team
  const handleJoinTeam = async () => {
    if (!currentUser && !publicKey) return;
    
    setIsJoining(true);
    try {
      const success = await joinTeam(teamId);
      if (!success) {
        throw new Error('Failed to join club');
      }
    } catch (err) {
      console.error('Error joining team:', err);
    } finally {
      setIsJoining(false);
    }
  };
  
  // Handle leaving a team
  const handleLeaveTeam = async () => {
    if (confirm('Are you sure you want to leave this club?')) {
      setIsLeaving(true);
      try {
        const success = await leaveTeam(teamId);
        if (success) {
          navigate('/teams');
        }
      } catch (err) {
        console.error('Error leaving team:', err);
      } finally {
        setIsLeaving(false);
      }
    }
  };
  
  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !currentUser) return;
    
    setIsJoining(true);
    try {
      await sendMessage(teamId, messageText.trim());
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsJoining(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get display name for a user ID (simplified for demo)
  const getUserName = (userId) => {
    if (!userId) return 'Unknown User';
    
    // In a real app, this would fetch user profiles from a proper user service
    return `User ${userId.substring(0, 6)}`;
  };
  
  // Handle challenge participation
  const handleJoinChallenge = (challengeId) => {
    if (!currentUser) {
      return; // User must be logged in
    }
    
    joinChallenge(challengeId);
  };
  
  if (loading) {
    return (
      <div className="px-4 pt-6 text-center">
        <div className="loading-spinner mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading club details...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="px-4 pt-6">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error}</p>
          <div className="mt-4 flex justify-center space-x-4">
            <button 
              onClick={() => navigate('/teams')}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg"
            >
              Back to Clubs
            </button>
            <button 
              onClick={clearError}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!selectedTeam) {
    return (
      <div className="px-4 pt-6 text-center">
        <h2 className="text-xl font-bold mb-4">Club Not Found</h2>
        <p className="text-gray-400 mb-6">We couldn&apos;t find the club you were looking for.</p>
        <button
          onClick={() => navigate('/teams')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Back to Clubs
        </button>
      </div>
    );
  }
  
  return (
    <div className="px-4 pt-6 pb-20">
      {/* Back button */}
      <div className="mb-4">
        <Link to="/teams" className="text-blue-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Clubs
        </Link>
      </div>
      
      {/* Team Header */}
      <div className="flex flex-col items-center mb-6">
        {selectedTeam.imageUrl ? (
          <img 
            src={selectedTeam.imageUrl} 
            alt={selectedTeam.name} 
            className="w-24 h-24 rounded-full mb-4 object-cover" 
          />
        ) : (
          <div className="w-24 h-24 rounded-full mb-4 bg-blue-900/50 flex items-center justify-center">
            <span className="text-3xl font-bold">{selectedTeam.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">{selectedTeam.name}</h1>
            {selectedTeam.hasNostrGroup && (
              <span className="ml-2 bg-purple-900/50 text-purple-400 text-xs px-2 py-1 rounded">
                Nostr Enabled
              </span>
            )}
          </div>
          
          <p className="text-gray-400 mb-2">
            {selectedTeam.memberCount || teamMembers?.length || 0} member{(selectedTeam.memberCount || teamMembers?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Join/Leave Button */}
        {currentUser || publicKey ? (
          isMember ? (
            <button
              onClick={handleLeaveTeam}
              disabled={isLeaving}
              className="px-4 py-2 bg-red-800 text-white rounded-lg"
            >
              {isLeaving ? 'Leaving...' : 'Leave Club'}
            </button>
          ) : (
            <button
              onClick={handleJoinTeam}
              disabled={isJoining}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              {isJoining ? 'Joining...' : 'Join Club'}
            </button>
          )
        ) : (
          <div className="text-center">
            <p className="text-yellow-400 mb-2">Please log in to join this club</p>
          </div>
        )}
      </div>
      
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 whitespace-nowrap ${activeTab === 'overview' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 whitespace-nowrap ${activeTab === 'chat' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`px-4 py-2 whitespace-nowrap ${activeTab === 'members' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        <button
          className={`px-4 py-2 whitespace-nowrap ${activeTab === 'leaderboard' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button
          className={`px-4 py-2 whitespace-nowrap ${activeTab === 'challenges' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('challenges')}
        >
          Challenges
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="bg-[#1a222e] rounded-lg p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">About This Club</h2>
            
            {selectedTeam.description ? (
              <p className="text-gray-300 mb-6">{selectedTeam.description}</p>
            ) : (
              <p className="text-gray-500 italic mb-6">No description available.</p>
            )}
            
            {/* Pinned Posts */}
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">
              Pinned Announcements
            </h3>
            
            {pinnedPosts && pinnedPosts.length > 0 ? (
              <div className="space-y-4 mb-6">
                {pinnedPosts.map(post => (
                  <div key={post.id} className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{post.title || 'Announcement'}</h4>
                      <span className="text-xs text-gray-500">{formatDate(post.pinnedAt)}</span>
                    </div>
                    <p className="text-gray-300">{post.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic mb-6">No pinned announcements.</p>
            )}
            
            {/* Recent Activity Preview */}
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">
              Recent Activity
            </h3>
            
            {teamMessages && teamMessages.length > 0 ? (
              <div className="space-y-3 mb-4">
                {teamMessages.slice(-3).map(message => (
                  <div key={message.id} className="bg-gray-800/30 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{getUserName(message.userId)}</span>
                      <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-300">{message.content}</p>
                  </div>
                ))}
                <button
                  onClick={() => setActiveTab('chat')}
                  className="text-blue-400 text-sm hover:underline"
                >
                  See all messages
                </button>
              </div>
            ) : (
              <p className="text-gray-500 italic">No recent activity.</p>
            )}
          </div>
        )}
        
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Club Chat</h2>
            
            {/* Messages Area */}
            <div className="bg-[#111827] rounded-lg p-4 mb-4 min-h-[300px] max-h-[400px] overflow-y-auto">
              {teamMessages && teamMessages.length > 0 ? (
                <div className="space-y-4">
                  {teamMessages.map(message => (
                    <div 
                      key={message.id} 
                      className={`rounded-lg p-3 max-w-[85%] ${
                        message.userId === currentUser 
                          ? 'bg-blue-900/30 ml-auto' 
                          : 'bg-gray-800'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">
                          {message.userId === currentUser ? 'You' : getUserName(message.userId)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">{formatDate(message.timestamp)}</span>
                      </div>
                      <p className="text-gray-300">{message.content}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 italic">No messages yet. Be the first to say hello!</p>
                </div>
              )}
            </div>
            
            {/* Message Input */}
            {!currentUser ? (
              <div className="text-center p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                <p className="text-yellow-400 mb-2">Please log in to participate in the discussion</p>
              </div>
            ) : isMember ? (
              <form onSubmit={handleSendMessage} className="flex">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 p-3 bg-[#111827] border border-gray-700 rounded-l-lg"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-r-lg ${
                    !messageText.trim() ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  Send
                </button>
              </form>
            ) : (
              <div className="text-center p-4 bg-blue-900/20 rounded-lg">
                <p className="text-gray-300 mb-2">You need to join this club to participate in the chat.</p>
                <button
                  onClick={handleJoinTeam}
                  disabled={isJoining}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  {isJoining ? 'Joining...' : 'Join Club'}
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Club Members</h2>
            
            {teamMembers && teamMembers.length > 0 ? (
              <div className="space-y-3">
                {teamMembers.map(member => (
                  <div key={member.id} className="bg-[#111827] rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center mr-3">
                        <span className="font-bold">{getUserName(member.userId).charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{getUserName(member.userId)}</p>
                        <p className="text-xs text-gray-500">
                          {member.role === 'admin' ? 'Admin' : 'Member'} • Joined {formatDate(member.joinedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No members found.</p>
            )}
          </div>
        )}
        
        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Club Leaderboard</h2>
            
            <div className="bg-[#111827] rounded-lg p-4">
              <p className="text-center text-gray-500 italic py-8">
                The leaderboard will automatically track active members based on their running activity.
              </p>
              <p className="text-center text-blue-400 text-sm">
                This feature will be available when members log their runs.
              </p>
            </div>
          </div>
        )}
        
        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Club Challenges</h2>
            
            {isAdmin && (
              <button
                onClick={() => alert('Challenge creation coming soon')}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Create New Challenge
              </button>
            )}
            
            {teamChallenges && teamChallenges.length > 0 ? (
              <div className="space-y-4">
                {teamChallenges.map(challenge => (
                  <div key={challenge.id} className="bg-[#111827] rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{challenge.title || 'Challenge'}</h3>
                    <p className="text-gray-300 mb-3">{challenge.description}</p>
                    
                    <div className="flex justify-between text-sm text-gray-400 mb-4">
                      <span>Created: {formatDate(challenge.createdAt)}</span>
                      <span>{challenge.participants?.length || 0} participants</span>
                    </div>
                    
                    {!currentUser ? (
                      <div className="text-center p-2 bg-yellow-900/20 rounded-lg">
                        <p className="text-yellow-400 text-sm">Log in to join challenges</p>
                      </div>
                    ) : isMember ? (
                      <button
                        onClick={() => handleJoinChallenge(challenge.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg w-full"
                      >
                        {challenge.participants?.includes(currentUser) 
                          ? 'View Challenge Details' 
                          : 'Accept Challenge'}
                      </button>
                    ) : (
                      <div className="text-center p-2 bg-blue-900/20 rounded-lg">
                        <p className="text-gray-300 text-sm">Join club to participate in challenges</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#111827] rounded-lg p-4 text-center">
                <p className="text-gray-500 italic py-6">No challenges available at the moment.</p>
                {isAdmin && (
                  <p className="text-blue-400 text-sm">
                    As an admin, you can create challenges for club members.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDetail; 