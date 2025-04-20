import { formatPostContent } from '../utils/postFormatters';
import PropTypes from 'prop-types';
import { useState, useCallback, memo } from 'react';
import { Heart, MessageSquare, Repeat, Zap, Camera, X, ImageIcon, Share2 } from "lucide-react";
import BottomSheet from './ui/BottomSheet';
import { vibrate } from '../utils/platform';
import './Post.css';

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
        
        {/* Display comment images if present */}
        {comment.images && comment.images.length > 0 && (
          <div className="comment-images">
            {comment.images.map((imageUrl, index) => (
              <div key={index} className="comment-image-container">
                <img 
                  src={imageUrl} 
                  alt={`Comment image ${index + 1}`}
                  className="comment-image"
                  loading="lazy"
                  onClick={() => {
                    // Show image in full screen when clicked
                    const imageElement = document.createElement('div');
                    imageElement.className = 'fullscreen-image-container';
                    imageElement.innerHTML = `
                      <div class="fullscreen-image-backdrop"></div>
                      <img src="${imageUrl}" alt="Full size" class="fullscreen-image" />
                    `;
                    imageElement.addEventListener('click', () => {
                      document.body.removeChild(imageElement);
                      vibrate('light');
                    });
                    document.body.appendChild(imageElement);
                    vibrate('light');
                  }}
                />
              </div>
            ))}
          </div>
        )}
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
    }).isRequired,
    images: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  handleAvatarError: PropTypes.func.isRequired
};

/**
 * Component for displaying a single post in the run feed - optimized for mobile
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
  wallet,
  commentImages = [],
  handleAddCommentImage,
  handleRemoveCommentImage
}) => {
  // Track bottom sheet states
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [showPostActionsSheet, setShowPostActionsSheet] = useState(false);
  const [showImageOptionsSheet, setShowImageOptionsSheet] = useState(false);
  
  // Track if comments are loading
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Handle avatar error
  const handleAvatarError = (event) => {
    event.target.src = '/default-avatar.svg';
  };

  // Handle image load to ensure smooth transitions
  const handleImageLoad = (event) => {
    // Add a loaded class to improve image fade-in
    event.target.classList.add('image-loaded');
  };

  // Format date for mobile
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
  
  // Use the pre-extracted images array from the post object
  const images = post.images || [];

  // Create HTML from formatted content
  const formattedContent = formatPostContent(post.content);

  // Handle comment click with loading state
  const handleCommentClickWithLoading = useCallback((postId) => {
    vibrate('light');
    
    if (!post.commentsLoaded && !commentsLoading) {
      setCommentsLoading(true);
      // Call the original handler which should load the comments
      handleCommentClick(postId).finally(() => {
        setCommentsLoading(false);
        setShowCommentsSheet(true);
      });
    } else {
      setShowCommentsSheet(true);
    }
  }, [post, commentsLoading, handleCommentClick]);

  /**
   * Handles camera capture for comments
   */
  const handleCameraCapture = () => {
    setShowImageOptionsSheet(false);
    vibrate('light');
    
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use the back camera
    
    // Handle file selection
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        handleAddCommentImage(file, imageUrl);
        vibrate('light');
      }
    };
    
    // Trigger file selection dialog
    input.click();
  };

  /**
   * Handles gallery selection for comments
   */
  const handleGallerySelect = () => {
    setShowImageOptionsSheet(false);
    vibrate('light');
    
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // No capture attribute means it will open gallery
    
    // Handle file selection
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        handleAddCommentImage(file, imageUrl);
        vibrate('light');
      }
    };
    
    // Trigger file selection dialog
    input.click();
  };
  
  // Handle post-specific actions
  const handleLikeWithFeedback = (post) => {
    vibrate(userLikes.has(post.id) ? 'light' : 'medium');
    handleLike(post);
    setShowPostActionsSheet(false);
  };
  
  const handleRepostWithFeedback = (post) => {
    vibrate(userReposts.has(post.id) ? 'light' : 'medium');
    handleRepost(post);
    setShowPostActionsSheet(false);
  };
  
  const handleZapWithFeedback = (post, wallet) => {
    vibrate('medium');
    handleZap(post, wallet);
    setShowPostActionsSheet(false);
  };
  
  const handleSharePost = () => {
    vibrate('light');
    
    // Implement share functionality
    if (navigator.share) {
      navigator.share({
        title: `${post.author.profile.name}'s post on Runstr`,
        text: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        url: window.location.href
      }).catch(err => console.error('Error sharing post:', err));
    }
    
    setShowPostActionsSheet(false);
  };
  
  // Handle comment submission with feedback
  const handleCommentWithFeedback = (postId) => {
    vibrate('medium');
    handleComment(postId);
  };

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
        
        {/* Add a more button that opens the action sheet */}
        <button 
          className="post-more-button"
          onClick={() => {
            vibrate('light');
            setShowPostActionsSheet(true);
          }}
          aria-label="Post actions"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
                    // Show in full screen
                    const imageElement = document.createElement('div');
                    imageElement.className = 'fullscreen-image-container';
                    imageElement.innerHTML = `
                      <div class="fullscreen-image-backdrop"></div>
                      <img src="${imageUrl}" alt="Full size" class="fullscreen-image" />
                    `;
                    imageElement.addEventListener('click', () => {
                      document.body.removeChild(imageElement);
                      vibrate('light');
                    });
                    document.body.appendChild(imageElement);
                    vibrate('light');
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
          className="action-button comment-button"
          onClick={() => handleCommentClickWithLoading(post.id)}
        >
          <MessageSquare className="h-5 w-5 mr-1" />
          <span className="action-text">Comment</span>
          {(post.comments?.length > 0) && <span className="action-count">{post.comments.length}</span>}
        </button>
        
        <button
          className={`action-button like-button ${userLikes.has(post.id) ? 'liked' : ''}`}
          onClick={() => handleLikeWithFeedback(post)}
        >
          <Heart className={`h-5 w-5 mr-1 ${userLikes.has(post.id) ? 'fill-current' : ''}`} />
          <span className="action-text">Like</span>
          {post.likes > 0 && <span className="action-count">{post.likes}</span>}
        </button>
      </div>
      
      {/* Bottom Sheet for Post Actions */}
      <BottomSheet
        isOpen={showPostActionsSheet}
        onClose={() => setShowPostActionsSheet(false)}
        height="auto"
        title="Post Actions"
      >
        <div className="post-actions-sheet">
          <button 
            className={`post-action-item ${userLikes.has(post.id) ? 'active' : ''}`}
            onClick={() => handleLikeWithFeedback(post)}
          >
            <Heart className={`h-6 w-6 ${userLikes.has(post.id) ? 'fill-current text-red-500' : ''}`} />
            <span>{userLikes.has(post.id) ? 'Unlike' : 'Like'}</span>
          </button>
          
          <button 
            className={`post-action-item ${userReposts.has(post.id) ? 'active' : ''}`}
            onClick={() => handleRepostWithFeedback(post)}
          >
            <Repeat className={`h-6 w-6 ${userReposts.has(post.id) ? 'text-green-500' : ''}`} />
            <span>{userReposts.has(post.id) ? 'Undo Repost' : 'Repost'}</span>
          </button>
          
          <button 
            className="post-action-item"
            onClick={() => handleZapWithFeedback(post, wallet)}
          >
            <Zap className="h-6 w-6 text-yellow-500" />
            <span>Send Kudos</span>
          </button>
          
          <button 
            className="post-action-item"
            onClick={handleSharePost}
          >
            <Share2 className="h-6 w-6 text-blue-500" />
            <span>Share</span>
          </button>
        </div>
      </BottomSheet>
      
      {/* Bottom Sheet for Comments */}
      <BottomSheet
        isOpen={showCommentsSheet}
        onClose={() => setShowCommentsSheet(false)}
        height="75%"
        title="Comments"
      >
        <div className="comments-section-sheet">
          <div className="comments-list">
            {commentsLoading ? (
              <div className="comments-loading">Loading comments...</div>
            ) : (
              <>
                {post.comments && post.comments.length > 0 ? (
                  <>
                    {/* Show all comments in the sheet */}
                    {post.comments.map((comment) => (
                      <Comment 
                        key={comment.id} 
                        comment={comment} 
                        handleAvatarError={handleAvatarError} 
                      />
                    ))}
                  </>
                ) : (
                  <div className="no-comments">No comments yet. Be the first to comment!</div>
                )}
              </>
            )}
          </div>
          
          {/* Display selected images for comments */}
          {commentImages.length > 0 && (
            <div className="comment-image-preview">
              {commentImages.map((image, index) => (
                <div key={index} className="comment-image-preview-item">
                  <img 
                    src={image.url} 
                    alt={`Comment image ${index + 1}`} 
                    className="comment-image-thumbnail"
                  />
                  <button 
                    className="remove-comment-image"
                    onClick={() => {
                      handleRemoveCommentImage(index);
                      vibrate('light');
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="comment-input">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            
            <button 
              className="comment-add-image"
              onClick={() => {
                vibrate('light');
                setShowImageOptionsSheet(true);
              }}
              disabled={commentImages.length >= 3}
            >
              <Camera size={16} />
            </button>
            
            <button 
              onClick={() => handleCommentWithFeedback(post.id)}
              disabled={!commentText.trim() && commentImages.length === 0}
              className="comment-submit-button"
            >
              Post
            </button>
          </div>
        </div>
      </BottomSheet>
      
      {/* Bottom Sheet for Image Options */}
      <BottomSheet
        isOpen={showImageOptionsSheet}
        onClose={() => setShowImageOptionsSheet(false)}
        height="auto"
        title="Add Photo"
      >
        <div className="image-options-sheet">
          <button 
            className="image-option-item"
            onClick={handleCameraCapture}
          >
            <Camera className="h-6 w-6" />
            <span>Take Photo</span>
          </button>
          
          <button 
            className="image-option-item"
            onClick={handleGallerySelect}
          >
            <ImageIcon className="h-6 w-6" />
            <span>Choose from Gallery</span>
          </button>
        </div>
      </BottomSheet>
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
  commentImages: PropTypes.array,
  handleAddCommentImage: PropTypes.func,
  handleRemoveCommentImage: PropTypes.func
}; 