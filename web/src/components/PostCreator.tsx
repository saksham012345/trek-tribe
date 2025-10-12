import React, { useState } from 'react';
import api from '../config/api';

interface PostCreatorProps {
  onPostCreated: () => void;
  onClose: () => void;
}

const PostCreator: React.FC<PostCreatorProps> = ({ onPostCreated, onClose }) => {
  const [postType, setPostType] = useState<'trip_memory' | 'general_post' | 'link_share' | 'experience'>('general_post');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    images: [] as string[],
    links: [] as Array<{ title: string; url: string; description?: string }>,
    tripData: {
      destination: '',
      startDate: '',
      endDate: '',
      participants: 1,
      highlights: [] as string[],
      rating: 5
    },
    tags: [] as string[],
    isPublic: true
  });
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });
  const [newTag, setNewTag] = useState('');
  const [newHighlight, setNewHighlight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const postData = {
        type: postType,
        title: formData.title,
        content: formData.content,
        isPublic: formData.isPublic,
        ...(formData.images.length > 0 && { images: formData.images }),
        ...(formData.links.length > 0 && { links: formData.links }),
        ...(formData.tags.length > 0 && { tags: formData.tags }),
        ...(postType === 'trip_memory' && {
          tripData: {
            ...formData.tripData,
            startDate: new Date(formData.tripData.startDate).toISOString(),
            endDate: new Date(formData.tripData.endDate).toISOString()
          }
        })
      };

      await api.post('/api/posts', postData);
      onPostCreated();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const addLink = () => {
    if (newLink.title && newLink.url) {
      setFormData({
        ...formData,
        links: [...formData.links, newLink]
      });
      setNewLink({ title: '', url: '', description: '' });
    }
  };

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index)
    });
  };

  const addTag = () => {
    if (newTag.trim()) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index)
    });
  };

  const addHighlight = () => {
    if (newHighlight.trim()) {
      setFormData({
        ...formData,
        tripData: {
          ...formData.tripData,
          highlights: [...formData.tripData.highlights, newHighlight.trim()]
        }
      });
      setNewHighlight('');
    }
  };

  const removeHighlight = (index: number) => {
    setFormData({
      ...formData,
      tripData: {
        ...formData.tripData,
        highlights: formData.tripData.highlights.filter((_, i) => i !== index)
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New Post</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Post Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'general_post', label: 'General Post', icon: '📝' },
                  { value: 'trip_memory', label: 'Trip Memory', icon: '🏔️' },
                  { value: 'link_share', label: 'Link Share', icon: '🔗' },
                  { value: 'experience', label: 'Experience', icon: '✨' }
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setPostType(type.value as any)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      postType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter post title..."
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Share your thoughts..."
              />
            </div>

            {/* Trip Memory Fields */}
            {postType === 'trip_memory' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800">Trip Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.tripData.destination}
                      onChange={(e) => setFormData({
                        ...formData,
                        tripData: { ...formData.tripData, destination: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Where did you go?"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Participants
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.tripData.participants}
                      onChange={(e) => setFormData({
                        ...formData,
                        tripData: { ...formData.tripData, participants: parseInt(e.target.value) || 1 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.tripData.startDate}
                      onChange={(e) => setFormData({
                        ...formData,
                        tripData: { ...formData.tripData, startDate: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.tripData.endDate}
                      onChange={(e) => setFormData({
                        ...formData,
                        tripData: { ...formData.tripData, endDate: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.tripData.rating}
                    onChange={(e) => setFormData({
                      ...formData,
                      tripData: { ...formData.tripData, rating: parseInt(e.target.value) || 5 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Highlights
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newHighlight}
                      onChange={(e) => setNewHighlight(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Add a highlight..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
                    />
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tripData.highlights.map((highlight, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                      >
                        {highlight}
                        <button
                          type="button"
                          onClick={() => removeHighlight(index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Links */}
            {(postType === 'link_share' || postType === 'general_post') && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Links
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Link title..."
                  />
                  <input
                    type="url"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={addLink}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
                <input
                  type="text"
                  value={newLink.description}
                  onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Link description (optional)..."
                />
                
                {formData.links.map((link, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{link.title}</p>
                      <p className="text-sm text-gray-600">{link.url}</p>
                      {link.description && (
                        <p className="text-sm text-gray-500">{link.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      className="text-red-600 hover:text-red-800 ml-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Add a tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(index)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Make this post public</span>
              </label>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostCreator;
