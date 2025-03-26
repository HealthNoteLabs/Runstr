import { Post } from './Post';

const PostList = ({
  posts,
  loading,
  hasMore,
  onLoadMore,
  onRefresh,
  isRefreshing,
  userLikes,
  userReposts,
  onLike,
  onRepost,
  onComment,
  commentText,
  setCommentText,
  handleCommentClick,
  handleZap,
  wallet
}) => {
  return (
    <div className="posts-list">
      {posts.map((post) => (
        <Post
          key={post.id}
          post={post}
          isLiked={userLikes.has(post.id)}
          isReposted={userReposts.has(post.id)}
          onLike={() => onLike(post)}
          onRepost={() => onRepost(post)}
          onComment={() => onComment(post)}
          commentText={commentText}
          setCommentText={setCommentText}
          handleCommentClick={handleCommentClick}
          handleZap={() => handleZap(post)}
          wallet={wallet}
        />
      ))}
      
      {loading && hasMore && (
        <div className="loading-indicator">
          Loading more posts...
        </div>
      )}
      
      {!loading && hasMore && (
        <button 
          className="load-more-button"
          onClick={onLoadMore}
        >
          Load More
        </button>
      )}
    </div>
  );
};

export default PostList; 