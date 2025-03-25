import React from 'react';
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
  handleCommentClick,
  handleComment,
  handleZap,
  wallet
}) => {
  return (
    <div className="space-y-6">
      {posts.map(post => (
        <Post
          key={post.id}
          post={post}
          userLikes={userLikes}
          userReposts={userReposts}
          handleLike={handleLike}
          handleRepost={handleRepost}
          handleCommentClick={handleCommentClick}
          handleComment={handleComment}
          handleZap={handleZap}
          wallet={wallet}
        />
      ))}
      {loading && page > 1 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

PostList.propTypes = {
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
      created_at: PropTypes.number.isRequired,
      author: PropTypes.shape({
        pubkey: PropTypes.string.isRequired,
        profile: PropTypes.object.isRequired
      }).isRequired,
      likes: PropTypes.number.isRequired,
      reposts: PropTypes.number.isRequired,
      zaps: PropTypes.number.isRequired
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  page: PropTypes.number.isRequired,
  userLikes: PropTypes.instanceOf(Set).isRequired,
  userReposts: PropTypes.instanceOf(Set).isRequired,
  handleLike: PropTypes.func.isRequired,
  handleRepost: PropTypes.func.isRequired,
  handleCommentClick: PropTypes.func.isRequired,
  handleComment: PropTypes.func.isRequired,
  handleZap: PropTypes.func.isRequired,
  wallet: PropTypes.object
}; 