import { formatSplitTimesInContent } from '../utils/postFormatters';
import PropTypes from 'prop-types';

/**
 * Component for displaying a single post in the run feed - optimized for Android
 */
export const Post = ({
  post,
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
  // Android optimization: handle avatar error
  const handleAvatarError = (event) => {
    event.target.src = '/default-avatar.svg';
  };

  // Handle image load to ensure smooth transitions
  const handleImageLoad = (event) => {
    // Add a loaded class to improve image fade-in
    event.target.classList.add('image-loaded');
  };

  // Format date for Android
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffMs = now - date;
      const diffSeconds = Math.floor(diffMs / 1000);
      
      // Within a minute
      if (diffSeconds < 60) {
        return 'just now';
      }
      
      // Within an hour
      if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes}m ago`;
      }
      
      // Within a day
      if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return `${hours}h ago`;
      }
      
      // Within a week
      if (diffSeconds < 604800) {
        const days = Math.floor(diffSeconds / 86400);
        return `${days}d ago`;
      }
      
      // Older than a week - show simple date
      return date.toLocaleDateString();
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'unknown date';
    }
  };

  // Detect mobile
  const isMobile = true;
  
  // Use the pre-extracted images array from the post object
  const images = post.images || [];

  return (
    <div className="post-card" data-post-id={post.id}>
      <div className="post-header">
        <img
          src={post.author.profile.picture || '/default-avatar.svg'}
          alt={post.author.profile.name || 'Anonymous'}
          className="author-avatar"
          onError={handleAvatarError}
          loading="lazy"
          width="48"
          height="48"
        />
        <div className="author-info">
          <h4>{post.author.profile.name || 'Anonymous Runner'}</h4>
          <span className="post-date">
            {formatDate(post.created_at)}
          </span>
        </div>
      </div>
      
      <div className="post-content">
        {formatSplitTimesInContent(post.content)}
        {images.length > 0 && (
          <div className="post-images">
            {images.slice(0, 2).map(
              (imageUrl, index) => (
                <div 
                  key={index}
                  className="image-container"
                  style={{ 
                    aspectRatio: '16/9',
                    position: 'relative'
                  }}
                >
                  <img
                    src={imageUrl}
                    alt="Run activity"
                    className="post-image"
                    loading="lazy"
                    width="100%"
                    height="100%"
                    onLoad={handleImageLoad}
                    style={{ 
                      objectFit: 'cover',
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      top: 0,
                      left: 0
                    }}
                    onClick={() => {
                      // On Android, simply show in full screen instead of opening a new window
                      const imageElement = document.createElement('div');
                      imageElement.className = 'fullscreen-image-container';
                      imageElement.innerHTML = `
                        <div class="fullscreen-image-backdrop"></div>
                        <img src="${imageUrl}" alt="Full size" class="fullscreen-image" />
                      `;
                      imageElement.addEventListener('click', () => {
                        document.body.removeChild(imageElement);
                      });
                      document.body.appendChild(imageElement);
                    }}
                  />
                </div>
              )
            )}
            {images.length > 2 && (
              <div className="more-images-indicator">
                +{images.length - 2} more
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="post-actions">
        <button
          className="zap-button"
          onClick={() => handleZap(post, wallet)}
        >
          ⚡️ {post.zaps > 0 ? post.zaps : ''}
        </button>
        <button
          className={`like-button ${userLikes.has(post.id) ? 'liked' : ''}`}
          onClick={() => handleLike(post)}
        >
          {userLikes.has(post.id) ? '❤️' : '🤍'} {post.likes > 0 ? post.likes : ''}
        </button>
        <button
          className={`repost-button ${userReposts.has(post.id) ? 'reposted' : ''}`}
          onClick={() => handleRepost(post)}
        >
          {userReposts.has(post.id) ? '🔁' : '🔄'} {post.reposts > 0 ? post.reposts : ''}
        </button>
        <button
          className="comment-button"
          onClick={() => handleCommentClick(post.id)}
        >
          💬 {post.comments?.length || 0}
        </button>
      </div>
      
      {post.showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {post.comments?.map((comment) => (
              <div key={comment.id} className="comment-item">
                <img
                  src={comment.author.profile.picture || '/default-avatar.svg'}
                  alt={comment.author.profile.name}
                  className="comment-avatar"
                  onError={handleAvatarError}
                  loading="lazy"
                  width="32"
                  height="32"
                />
                <div className="comment-content">
                  <strong>
                    {comment.author.profile.name || 'Anonymous'}
                  </strong>
                  <p>{comment.content}</p>
                </div>
              </div>
            ))}
            {post.comments?.length === 0 && (
              <div className="no-comments">No comments yet. Be the first to comment!</div>
            )}
          </div>
          <div className="comment-input">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isMobile) {
                  handleComment(post.id);
                }
              }}
            />
            <button 
              onClick={() => handleComment(post.id)}
              disabled={!commentText.trim()}
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Add prop types for linter validation
Post.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    created_at: PropTypes.number.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.object,
    }).isRequired,
    comments: PropTypes.array,
    showComments: PropTypes.bool,
    likes: PropTypes.number,
    reposts: PropTypes.number,
    zaps: PropTypes.number,
    zapAmount: PropTypes.number,
    images: PropTypes.array,
  }).isRequired,
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
}; 