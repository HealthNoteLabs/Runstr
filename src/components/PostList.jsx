import { Post } from './Post';

export const PostList = ({
  posts,
  loading,
  page,
  userLikes,
  userReposts,
  handleLike,
  handleRepost,
  handleZap,
  handleCommentClick,
  handleComment,
  commentText,
  setCommentText,
  wallet
}) => {
  return (
    <div className="posts-container">
      {/* Diagnostic counter */}
      <div className="diagnostic-counter" style={{ 
        background: '#111',
        color: '#0f0',
        padding: '8px',
        marginBottom: '10px',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }}>
        Rendering {posts.length} posts
      </div>
      
      {posts.map((post) => (
        <Post
          key={post.id}
          post={post}
          userLikes={userLikes}
          userReposts={userReposts}
          handleLike={handleLike}
          handleRepost={handleRepost}
          handleZap={handleZap}
          handleCommentClick={handleCommentClick}
          handleComment={handleComment}
          commentText={commentText}
          setCommentText={setCommentText}
          wallet={wallet}
        />
      ))}
      {loading && page > 1 && (
        <div className="loading-more">Loading more posts...</div>
      )}
    </div>
  );
}; 