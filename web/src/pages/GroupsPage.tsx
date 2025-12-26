import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Groups.css';

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  coverImage?: string;
  creatorId: { _id: string; name: string; profilePhoto?: string };
  memberCount: number;
  isPublic: boolean;
  tags?: string[];
  location?: string;
}

const CATEGORIES = ['trekking', 'camping', 'backpacking', 'mountaineering', 'photography', 'wildlife', 'cultural', 'adventure', 'other'];

export const GroupsPage: React.FC = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'trekking',
    isPublic: true,
    tags: ''
  });
  const [userGroups, setUserGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGroups();
  }, [page, selectedCategory]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12'
      });
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await api.get(`/api/groups?${params}`);

      setGroups(response.data.groups);
      setTotalPages(response.data.pagination.totalPages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to create a group');
      return;
    }

    try {
      const response = await api.post(
        '/api/groups',
        {
          ...formData,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        }
      );

      setSuccessMessage('✅ Group created successfully! +50 reputation points');
      setFormData({ name: '', description: '', category: 'trekking', isPublic: true, tags: '' });
      setShowCreateForm(false);
      fetchGroups();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to join a group');
      return;
    }

    try {
      await api.post(
        `/api/groups/${groupId}/join`,
        {}
      );

      setSuccessMessage('✅ Joined group! +10 reputation points');
      setUserGroups(new Set([...userGroups, groupId]));

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await api.post(
        `/api/groups/${groupId}/leave`,
        {}
      );

      const newGroups = new Set(userGroups);
      newGroups.delete(groupId);
      setUserGroups(newGroups);
      setSuccessMessage('Left group');

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to leave group');
    }
  };

  const isMember = (groupId: string) => userGroups.has(groupId);

  return (
    <div className="groups-page">
      <div className="groups-header">
        <div className="header-content">
          <h1>👥 Communities & Groups</h1>
          <p>Join interest-based communities of travelers and organizers</p>
        </div>
        {localStorage.getItem('token') && (
          <button
            className="btn-create-group"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? '✕ Cancel' : '+ Create Group'}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Create Group Form */}
      {showCreateForm && (
        <div className="create-group-form">
          <h2>Create New Group</h2>
          <form onSubmit={handleCreateGroup}>
            <div className="form-group">
              <label>Group Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Himalayan Trekkers"
              />
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your group and its purpose"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  />
                  <span>Public Group</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., hiking, mountains, adventure"
              />
            </div>

            <button type="submit" className="btn btn-primary">Create Group</button>
          </form>
        </div>
      )}

      {/* Category Filter */}
      <div className="category-filter">
        <button
          className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
          onClick={() => { setSelectedCategory(''); setPage(1); }}
        >
          All Categories
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => { setSelectedCategory(cat); setPage(1); }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="loading">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p>No groups found in this category</p>
        </div>
      ) : (
        <>
          <div className="groups-grid">
            {groups.map(group => (
              <div key={group._id} className="group-card">
                {group.coverImage && (
                  <div
                    className="group-cover"
                    style={{ backgroundImage: `url(${group.coverImage})` }}
                  />
                )}

                <div className="group-content">
                  <div className="group-header">
                    <h3>{group.name}</h3>
                    {!group.isPublic && <span className="private-badge">🔒 Private</span>}
                  </div>

                  <p className="group-category">{group.category}</p>

                  <p className="group-description">{group.description}</p>

                  {group.tags && group.tags.length > 0 && (
                    <div className="group-tags">
                      {group.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="group-footer">
                    <div className="group-stats">
                      <span>👥 {group.memberCount} members</span>
                    </div>

                    {localStorage.getItem('token') ? (
                      <button
                        className={`btn-join ${isMember(group._id) ? 'joined' : ''}`}
                        onClick={() =>
                          isMember(group._id)
                            ? handleLeaveGroup(group._id)
                            : handleJoinGroup(group._id)
                        }
                      >
                        {isMember(group._id) ? '✓ Joined' : '+ Join'}
                      </button>
                    ) : (
                      <span className="login-prompt">Sign in to join</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="pagination-btn"
              >
                ← Previous
              </button>

              <div className="page-info">
                Page {page} of {totalPages}
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GroupsPage;
