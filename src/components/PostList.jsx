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