import { formatPostContent } from '../utils/postFormatters';
import PropTypes from 'prop-types';
import { useState, useCallback, memo } from 'react';
import { Heart, MessageSquare, Repeat, Zap } from "lucide-react";

/**
 * Comment component - memoized to prevent unnecessary re-renders
 */
const Comment = memo(({ comment, handleAvatarError }) => {
  return (
    <div className="comment-item">
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
  );
});

// Add displayName for debugging
Comment.displayName = 'Comment';

// Add prop types for the Comment component
Comment.propTypes = {
  comment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string,
      profile: PropTypes.shape({
        name: PropTypes.string,
        picture: PropTypes.string
      })
    }).isRequired
  }).isRequired,
  handleAvatarError: PropTypes.func.isRequired
};

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
  // Track if comments are loading
  const [commentsLoading, setCommentsLoading] = useState(false);

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

  // Create HTML from formatted content
  const formattedContent = formatPostContent(post.content);

  // Handle comment click with loading state
  const handleCommentClickWithLoading = useCallback((postId) => {
    if (!post.commentsLoaded && !commentsLoading) {
      setCommentsLoading(true);
      // Call the original handler which should load the comments
      handleCommentClick(postId).finally(() => {
        setCommentsLoading(false);
      });
    } else {
      handleCommentClick(postId);
    }
  }, [post, commentsLoading, handleCommentClick]);

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
      
      <div className="post-content" dangerouslySetInnerHTML={{ __html: formattedContent }}></div>
      
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
      
      <div className="post-actions">
        <button
          className="action-button zap-button"
          onClick={() => handleZap(post, wallet)}
        >
          <Zap className="h-5 w-5 mr-1" />
          <span className="action-text">Kudos</span>
          {post.zaps > 0 && <span className="action-count">{post.zaps}</span>}
        </button>
        <button
          className={`action-button like-button ${userLikes.has(post.id) ? 'liked' : ''}`}
          onClick={() => handleLike(post)}
        >
          <Heart className={`h-5 w-5 mr-1 ${userLikes.has(post.id) ? 'fill-current' : ''}`} />
          <span className="action-text">Like</span>
          {post.likes > 0 && <span className="action-count">{post.likes}</span>}
        </button>
        <button
          className={`action-button repost-button ${userReposts.has(post.id) ? 'reposted' : ''}`}
          onClick={() => handleRepost(post)}
        >
          <Repeat className="h-5 w-5 mr-1" />
          <span className="action-text">Repost</span>
          {post.reposts > 0 && <span className="action-count">{post.reposts}</span>}
        </button>
        <button
          className="action-button comment-button"
          onClick={() => handleCommentClickWithLoading(post.id)}
        >
          <MessageSquare className="h-5 w-5 mr-1" />
          <span className="action-text">Comment</span>
          {(post.comments?.length > 0) && <span className="action-count">{post.comments.length}</span>}
        </button>
      </div>
      
      {post.showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {commentsLoading ? (
              <div className="comments-loading">Loading comments...</div>
            ) : (
              <>
                {post.comments && post.comments.length > 0 ? (
                  <>
                    {/* Only render the first 5 comments initially, for better performance */}
                    {post.comments.slice(0, 5).map((comment) => (
                      <Comment 
                        key={comment.id} 
                        comment={comment} 
                        handleAvatarError={handleAvatarError} 
                      />
                    ))}
                    
                    {/* Show "View more comments" button if there are more than 5 comments */}
                    {post.comments.length > 5 && (
                      <button 
                        className="view-more-comments"
                        onClick={() => console.log('View all comments')}
                      >
                        View all {post.comments.length} comments
                      </button>
                    )}
                  </>
                ) : (
                  <div className="no-comments">No comments yet. Be the first to comment!</div>
                )}
              </>
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
    commentsLoaded: PropTypes.bool,
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