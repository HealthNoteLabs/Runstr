import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { extractImagesFromContent, formatSplitTimesInContent } from '../utils/content';

/**
 * Component for displaying a single post in the run feed - optimized for Android
 */
export const Post = ({
  post,
  userLikes,
  userReposts,
  handleLike,
  handleRepost,
  handleCommentClick,
  handleComment,
  handleZap,
  wallet
}) => {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  const handleSubmitComment = async () => {
    if (commentText.trim()) {
      await handleComment(post);
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  const formatDate = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const images = extractImagesFromContent(post.content);
  const formattedContent = formatSplitTimesInContent(post.content);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-start space-x-3">
        <img
          src={post.author.profile.picture || 'https://via.placeholder.com/40'}
          alt={post.author.profile.name}
          className="w-10 h-10 rounded-full"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/40';
          }}
        />
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{post.author.profile.name}</span>
            <span className="text-gray-500 text-sm">{formatDate(post.created_at)}</span>
          </div>
          <p className="mt-2 text-gray-800 whitespace-pre-wrap">{formattedContent}</p>
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Post image ${index + 1}`}
                  className="rounded-lg w-full h-48 object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center space-x-4">
            <button
              onClick={() => handleLike(post)}
              className={`flex items-center space-x-1 ${
                userLikes.has(post.id) ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill={userLikes.has(post.id) ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>{post.likes}</span>
            </button>
            <button
              onClick={() => handleRepost(post)}
              className={`flex items-center space-x-1 ${
                userReposts.has(post.id) ? 'text-green-500' : 'text-gray-500'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill={userReposts.has(post.id) ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              <span>{post.reposts}</span>
            </button>
            <button
              onClick={() => {
                handleCommentClick(post);
                setShowCommentInput(!showCommentInput);
              }}
              className="flex items-center space-x-1 text-gray-500"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>{post.comments?.length || 0}</span>
            </button>
            <button
              onClick={() => handleZap(post)}
              className="flex items-center space-x-1 text-gray-500"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>{post.zaps}</span>
            </button>
          </div>
          {showCommentInput && (
            <div className="mt-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
              />
              <div className="mt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowCommentInput(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitComment}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Post.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    created_at: PropTypes.number.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.shape({
        name: PropTypes.string.isRequired,
        picture: PropTypes.string
      }).isRequired
    }).isRequired,
    likes: PropTypes.number.isRequired,
    reposts: PropTypes.number.isRequired,
    zaps: PropTypes.number.isRequired,
    comments: PropTypes.array
  }).isRequired,
  userLikes: PropTypes.instanceOf(Set).isRequired,
  userReposts: PropTypes.instanceOf(Set).isRequired,
  handleLike: PropTypes.func.isRequired,
  handleRepost: PropTypes.func.isRequired,
  handleCommentClick: PropTypes.func.isRequired,
  handleComment: PropTypes.func.isRequired,
  handleZap: PropTypes.func.isRequired,
  wallet: PropTypes.object
}; 