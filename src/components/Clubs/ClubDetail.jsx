import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getGroupPosts, 
  checkGroupMembership, 
  requestToJoinGroup, 
  leaveGroup, 
  postToGroup, 
  getGroupMembers
} from '../../services/nip29';

export const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [club, setClub] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [membership, setMembership] = useState({ isMember: false, role: null });
  
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  
  // Load club, posts, members, and membership status
  useEffect(() => {
    const loadClubData = async () => {
      if (!clubId) return;
      
      // Set a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        setLoading(false);
        setError('Loading timed out. Please try again.');
      }, 15000); // 15 seconds timeout
      
      try {
        setLoading(true);
        
        // Get group posts (includes metadata)
        const groupPosts = await getGroupPosts(clubId);
        setPosts(groupPosts);
        
        // Extract group metadata from the first post if available
        if (groupPosts.length > 0) {
          // Try to find the metadata from group posts' tags
          for (const post of groupPosts) {
            const name = post.tags.find(t => t[0] === 'name')?.[1];
            const about = post.tags.find(t => t[0] === 'about')?.[1];
            
            if (name) {
              setClub({
                id: clubId,
                name,
                about: about || '',
                createdAt: post.created_at,
                createdBy: post.pubkey
              });
              break;
            }
          }
        }
        
        // If we couldn't find metadata, use a placeholder
        if (!club) {
          setClub({
            id: clubId,
            name: 'Running Club',
            about: 'A club for runners',
            createdAt: Math.floor(Date.now() / 1000),
            createdBy: ''
          });
        }
        
        // Get members list
        const groupMembers = await getGroupMembers(clubId);
        setMembers(groupMembers);
        
        // Check if the current user is a member
        const membershipStatus = await checkGroupMembership(clubId);
        setMembership(membershipStatus);
        
        setError(null);
      } catch (err) {
        console.error('Error loading club data:', err);
        setError('Failed to load club data');
      } finally {
        // Clear the timeout
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    };
    
    loadClubData();
  }, [clubId, club]);
  
  // Request to join the club
  const handleJoinRequest = async () => {
    try {
      setJoinRequestSent(true);
      const result = await requestToJoinGroup(clubId);
      
      if (result.success) {
        // Refresh membership status
        const membershipStatus = await checkGroupMembership(clubId);
        setMembership(membershipStatus);
      } else {
        setError(result.error || 'Failed to send join request');
        setJoinRequestSent(false);
      }
    } catch (err) {
      console.error('Error requesting to join club:', err);
      setError(err.message || 'An unexpected error occurred');
      setJoinRequestSent(false);
    }
  };
  
  // Leave the club
  const handleLeaveClub = async () => {
    try {
      setLeavingGroup(true);
      const result = await leaveGroup(clubId);
      
      if (result.success) {
        // Refresh membership status
        setMembership({ isMember: false, role: null });
      } else {
        setError(result.error || 'Failed to leave club');
      }
    } catch (err) {
      console.error('Error leaving club:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLeavingGroup(false);
    }
  };
  
  // Post to the club
  const handlePost = async () => {
    if (!postContent.trim()) return;
    
    try {
      setIsPosting(true);
      const result = await postToGroup(clubId, postContent);
      
      if (result.success) {
        // Clear the input and refresh posts
        setPostContent('');
        const groupPosts = await getGroupPosts(clubId);
        setPosts(groupPosts);
      } else {
        setError(result.error || 'Failed to post to club');
      }
    } catch (err) {
      console.error('Error posting to club:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center h-64">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => navigate('/club')}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg"
          >
            Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/club')}
          className="mr-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold truncate">{club?.name || 'Running Club'}</h2>
      </div>
      
      {/* Club Details */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">About</h3>
          <p className="text-gray-400">{club?.about || 'No description available.'}</p>
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {new Date((club?.createdAt || 0) * 1000).toLocaleDateString()}</span>
          <span>{members.length} members</span>
        </div>
        
        {/* Join/Leave buttons */}
        {membership.isMember ? (
          <button
            onClick={handleLeaveClub}
            className="mt-4 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center"
            disabled={leavingGroup}
          >
            {leavingGroup ? (
              <>
                <div className="loading-spinner w-4 h-4 mr-2"></div>
                Leaving...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave Club
              </>
            )}
          </button>
        ) : joinRequestSent ? (
          <div className="mt-4 w-full py-2 px-4 bg-gray-700 text-white rounded-lg text-center">
            Join Request Sent
          </div>
        ) : (
          <button
            onClick={handleJoinRequest}
            className="mt-4 w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Join Club
          </button>
        )}
      </div>
      
      {/* Post Form (visible only to members) */}
      {membership.isMember && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Post to Club</h3>
          <textarea
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white mb-2"
            placeholder="Share something with the club..."
            rows={3}
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
          />
          <button
            onClick={handlePost}
            disabled={isPosting || !postContent.trim()}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center"
          >
            {isPosting ? (
              <>
                <div className="loading-spinner w-4 h-4 mr-2"></div>
                Posting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Post
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Club Posts */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Club Posts</h3>
        
        {posts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
            <p>No posts in this club yet</p>
            {membership.isMember && (
              <p className="text-sm mt-2">Be the first to post!</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start mb-2">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">
                      {post.pubkey.substring(0, 8)}...
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(post.created_at * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="ml-13 pl-13">
                  <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Members List */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Members ({members.length})</h3>
        
        {members.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
            <p>No members yet</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-4">
            <ul className="divide-y divide-gray-700">
              {members.map((member) => (
                <li key={member.pubkey} className="py-2 flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">
                      {member.pubkey.substring(0, 8)}...
                    </div>
                    <div className="text-xs text-gray-500">
                      Joined: {new Date(member.addedAt * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}; 