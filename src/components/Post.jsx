import PropTypes from 'prop-types';
import { extractImagesFromContent, formatSplitTimesInContent } from '../utils/postFormatters';

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
  // Android optimization: lazy load images
  const lazyLoadImage = (event) => {
    const img = event.target;
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  };

  // Android optimization: handle avatar error
  const handleAvatarError = (event) => {
    event.target.src = '/default-avatar.png';
  };

  // Format date for Android
  const formatDate = (timestamp) => {
    try {
      // Convert Unix timestamp to milliseconds and create Date object
      const date = new Date(timestamp * 1000);
      const now = new Date();
      
      // Get timezone offset in minutes
      const tzOffset = date.getTimezoneOffset();
      
      // Adjust the date for local timezone
      const localDate = new Date(date.getTime() - (tzOffset * 60 * 1000));
      const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000));
      
      // Calculate difference in milliseconds
      const diffMs = localNow - localDate;
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
      
      // For older posts, show date and time in local format
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      return localDate.toLocaleDateString(undefined, options);
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'unknown date';
    }
  };

  // Detect mobile
  const isMobile = true;

  return (
    <div className="post-card" data-post-id={post.id}>
      <div className="post-header">
        <img
          src={post.author.profile.picture ? '/placeholder-avatar.png' : '/default-avatar.png'}
          data-src={post.author.profile.picture}
          alt={post.author.profile.name || 'Anonymous'}
          className="author-avatar"
          onLoad={lazyLoadImage}
          onError={handleAvatarError}
          loading="lazy"
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
        <div className="post-images">
          {extractImagesFromContent(post.content).slice(0, 2).map(
            (imageUrl, index) => (
              <img
                key={index}
                src={'/placeholder-image.png'}
                data-src={imageUrl}
                alt="Run activity"
                className="post-image"
                onLoad={lazyLoadImage}
                loading="lazy"
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
            )
          )}
          {extractImagesFromContent(post.content).length > 2 && (
            <div className="more-images-indicator">
              +{extractImagesFromContent(post.content).length - 2} more
            </div>
          )}
        </div>
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
                  src={
                    comment.author.profile.picture || '/default-avatar.png'
                  }
                  alt={comment.author.profile.name}
                  className="comment-avatar"
                  onError={handleAvatarError}
                  loading="lazy"
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

Post.propTypes = {
  post: PropTypes.shape({
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
    comments: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
      created_at: PropTypes.number.isRequired,
      author: PropTypes.shape({
        pubkey: PropTypes.string.isRequired,
        profile: PropTypes.shape({
          name: PropTypes.string,
          picture: PropTypes.string
        })
      }).isRequired
    })),
    showComments: PropTypes.bool
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
  wallet: PropTypes.object
};

Post.defaultProps = {
  post: {
    likes: 0,
    reposts: 0,
    zaps: 0,
    comments: [],
    showComments: false
  },
  wallet: null
}; 