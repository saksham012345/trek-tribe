import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Post {
  _id: string;
  type: 'trip_memory' | 'general_post' | 'link_share' | 'experience';
  title: string;
  content: string;
  images?: string[];
  links?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
  tripData?: {
    destination: string;
    startDate: string;
    endDate: string;
    participants?: number;
    highlights?: string[];
    rating?: number;
  };
  tags?: string[];
  likes: any[];
  comments: any[];
  isPublic: boolean;
  authorId: {
    _id: string;
    name: string;
    profilePhoto?: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PostCardProps {
  post: Post;
  onLikeUpdate?: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLikeUpdate }) => {
  const { user: currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (currentUser) {
      setIsLiked(post.likes.some((like: any) => like._id === currentUser.id));
    }
  }, [post.likes, currentUser]);

  const handleLike = async () => {
    if (!currentUser || loading) return;

    setLoading(true);
    try {
      const response = await api.post(`/api/posts/${post._id}/like`);
      setIsLiked(response.data.isLiked);
      setLikesCount(response.data.likesCount);
      onLikeUpdate?.();
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/posts/${post._id}/comments`);
      setComments(response.data.comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    try {
      const response = await api.post(`/api/posts/${post._id}/comments`, {
        content: newComment.trim()
      });
      setComments([response.data.comment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'trip_memory': return '🏔️';
      case 'general_post': return '📝';
      case 'link_share': return '🔗';
      case 'experience': return '✨';
      default: return '📄';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      {/* Post Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          {post.authorId.profilePhoto ? (
            <img 
              src={post.authorId.profilePhoto} 
              alt={post.authorId.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-lg">👤</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {post.authorId.name}
            </h3>
            <span className="text-sm text-gray-500">
              {getPostTypeIcon(post.type)}
            </span>
            <span className="text-xs text-gray-500 capitalize">
              {post.type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(post.createdAt)}
          </p>
        </div>
      </div>

      {/* Post Title */}
      <h2 className="text-xl font-bold text-gray-900 mb-3">
        {post.title}
      </h2>

      {/* Post Content */}
      <p className="text-gray-700 mb-4 leading-relaxed">
        {post.content}
      </p>

      {/* Trip Data */}
      {post.tripData && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h4 className="font-semibold text-blue-800 mb-2">🏔️ Trip Details</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Destination:</span> {post.tripData.destination}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {post.tripData.startDate} - {post.tripData.endDate}
            </div>
            {post.tripData.participants && (
              <div>
                <span className="font-medium">Participants:</span> {post.tripData.participants}
              </div>
            )}
            {post.tripData.rating && (
              <div>
                <span className="font-medium">Rating:</span> {'⭐'.repeat(post.tripData.rating)}
              </div>
            )}
          </div>
          
          {post.tripData.highlights && post.tripData.highlights.length > 0 && (
            <div className="mt-3">
              <span className="font-medium text-blue-800">Highlights:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {post.tripData.highlights.map((highlight, index) => (
                  <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Links */}
      {post.links && post.links.length > 0 && (
        <div className="space-y-2 mb-4">
          {post.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <div>
                  <p className="font-medium text-gray-900">{link.title}</p>
                  {link.description && (
                    <p className="text-sm text-gray-600">{link.description}</p>
                  )}
                  <p className="text-xs text-blue-600">{link.url}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag, index) => (
            <span key={index} className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {post.images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Post image ${index + 1}`}
              className="w-full h-32 object-cover rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-6">
          <button
            onClick={handleLike}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1 rounded-full transition-colors ${
              isLiked
                ? 'bg-red-100 text-red-600'
                : 'hover:bg-gray-100 text-gray-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={isLiked ? '❤️' : '🤍'}></span>
            <span className="text-sm">{likesCount}</span>
          </button>
          
          <button
            onClick={() => {
              setShowComments(!showComments);
              if (!showComments && comments.length === 0) {
                fetchComments();
              }
            }}
            className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <span>💬</span>
            <span className="text-sm">{post.comments.length}</span>
          </button>
        </div>

        {!post.isPublic && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            🔒 Private
          </span>
        )}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Add Comment */}
          {currentUser && (
            <form onSubmit={handleAddComment} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post
                </button>
              </div>
            </form>
          )}

          {/* Comments List */}
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment._id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {comment.authorId.profilePhoto ? (
                    <img 
                      src={comment.authorId.profilePhoto} 
                      alt={comment.authorId.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-medium text-gray-900 text-sm">{comment.authorId.name}</p>
                    <p className="text-gray-700 text-sm">{comment.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(comment.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
