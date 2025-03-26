import PropTypes from 'prop-types';
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

PostList.propTypes = {
  posts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    created_at: PropTypes.number.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.shape({
        name: PropTypes.string,
        picture: PropTypes.string
      })
    }).isRequired,
    likes: PropTypes.number,
    reposts: PropTypes.number,
    zaps: PropTypes.number,
    comments: PropTypes.array,
    showComments: PropTypes.bool
  })).isRequired,
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
  wallet: PropTypes.object
};

PostList.defaultProps = {
  posts: [],
  loading: false,
  page: 1,
  wallet: null
}; 