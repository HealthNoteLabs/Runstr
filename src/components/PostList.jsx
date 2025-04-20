import { Post } from './Post';
import PropTypes from 'prop-types';

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
  wallet,
  commentImages,
  handleAddCommentImage,
  handleRemoveCommentImage
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
          commentImages={commentImages}
          handleAddCommentImage={handleAddCommentImage}
          handleRemoveCommentImage={handleRemoveCommentImage}
        />
      ))}
      {loading && page > 1 && (
        <div className="loading-more">Loading more posts...</div>
      )}
    </div>
  );
};

PostList.propTypes = {
  posts: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  page: PropTypes.number.isRequired,
  userLikes: PropTypes.instanceOf(Set).isRequired,
  userReposts: PropTypes.instanceOf(Set).isRequired,
  handleLike: PropTypes.func.isRequired,
  handleRepost: PropTypes.func.isRequired,
  handleZap: PropTypes.func.isRequired,
  handleCommentClick: PropTypes.func.isRequired,
  handleComment: PropTypes.func.isRequired,
  commentText: PropTypes.string.isRequired,
  setCommentText: PropTypes.func.isRequired,
  wallet: PropTypes.object,
  commentImages: PropTypes.array,
  handleAddCommentImage: PropTypes.func,
  handleRemoveCommentImage: PropTypes.func
}; 