import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Events.css';

interface Event {
  _id: string;
  title: string;
  description: string;
  eventType: string;
  startDate: string;
  endDate: string;
  location?: string;
  isVirtual: boolean;
  virtualLink?: string;
  organizerId: { _id: string; name: string; profilePhoto?: string };
  attendeeCount: number;
  capacity?: number;
  status: string;
  price?: number;
  tags?: string[];
}

const EVENT_TYPES = ['trip', 'meetup', 'workshop', 'webinar', 'other'];
const EVENT_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

export const EventsPage: React.FC = () => {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('upcoming');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userRsvps, setUserRsvps] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'meetup',
    startDate: '',
    endDate: '',
    location: '',
    isVirtual: false,
    virtualLink: '',
    capacity: '',
    price: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [page, selectedType, selectedStatus, token]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '9',
        status: selectedStatus
      });
      if (selectedType) params.append('eventType', selectedType);

      const response = await axios.get(`/api/events?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      setEvents(response.data.events);
      setTotalPages(response.data.pagination.totalPages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Please log in to create an event');
      return;
    }

    try {
      await axios.post(
        '/api/events',
        {
          ...formData,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          price: formData.price ? parseFloat(formData.price) : undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage('✅ Event created successfully! +30 reputation points');
      resetForm();
      setShowCreateForm(false);
      fetchEvents();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create event');
    }
  };

  const handleRsvp = async (eventId: string) => {
    if (!token) {
      setError('Please log in to RSVP');
      return;
    }

    try {
      await axios.post(
        `/api/events/${eventId}/rsvp`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage('✅ RSVP confirmed! +10 reputation points');
      setUserRsvps(new Set([...userRsvps, eventId]));
      fetchEvents();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to RSVP');
    }
  };

  const handleCancelRsvp = async (eventId: string) => {
    if (!token) return;

    try {
      await axios.post(
        `/api/events/${eventId}/cancel-rsvp`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newRsvps = new Set(userRsvps);
      newRsvps.delete(eventId);
      setUserRsvps(newRsvps);
      setSuccessMessage('RSVP cancelled');
      fetchEvents();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel RSVP');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      eventType: 'meetup',
      startDate: '',
      endDate: '',
      location: '',
      isVirtual: false,
      virtualLink: '',
      capacity: '',
      price: ''
    });
  };

  const isUserRsvped = (eventId: string) => userRsvps.has(eventId);
  const getCapacityStatus = (event: Event) => {
    if (!event.capacity) return null;
    const remaining = event.capacity - event.attendeeCount;
    return remaining <= 0 ? '🔴 Full' : `🟢 ${remaining} spots left`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="events-page">
      <div className="events-header">
        <div className="header-content">
          <h1>📅 Events & Calendar</h1>
          <p>Discover and join upcoming trips, meetups, and workshops</p>
        </div>
        {token && user?.role === 'organizer' && (
          <button
            className="btn-create-event"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? '✕ Cancel' : '+ Create Event'}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Create Event Form */}
      {showCreateForm && (
        <div className="create-event-form">
          <h2>Create New Event</h2>
          <form onSubmit={handleCreateEvent}>
            <div className="form-row">
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekend Himalayan Trek"
                />
              </div>

              <div className="form-group">
                <label>Event Type *</label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the event"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>End Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isVirtual}
                  onChange={(e) => setFormData({ ...formData, isVirtual: e.target.checked })}
                />
                <span>This is a virtual event</span>
              </label>
            </div>

            {formData.isVirtual && (
              <div className="form-group">
                <label>Virtual Meeting Link</label>
                <input
                  type="url"
                  value={formData.virtualLink}
                  onChange={(e) => setFormData({ ...formData, virtualLink: e.target.value })}
                  placeholder="https://zoom.us/..."
                />
              </div>
            )}

            {!formData.isVirtual && (
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Event location"
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Max attendees"
                />
              </div>

              <div className="form-group">
                <label>Price (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary">Create Event</button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="events-filters">
        <div className="filter-section">
          <h3>Status</h3>
          <div className="filter-buttons">
            {EVENT_STATUSES.map(status => (
              <button
                key={status}
                className={`filter-btn ${selectedStatus === status ? 'active' : ''}`}
                onClick={() => { setSelectedStatus(status); setPage(1); }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Type</h3>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${!selectedType ? 'active' : ''}`}
              onClick={() => { setSelectedType(''); setPage(1); }}
            >
              All Types
            </button>
            {EVENT_TYPES.map(type => (
              <button
                key={type}
                className={`filter-btn ${selectedType === type ? 'active' : ''}`}
                onClick={() => { setSelectedType(type); setPage(1); }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="loading">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No events found</p>
        </div>
      ) : (
        <>
          <div className="events-grid">
            {events.map(event => (
              <div key={event._id} className={`event-card ${event.status}`}>
                <div className="event-header">
                  <div className="event-type-badge">{event.eventType}</div>
                  <span className={`status-badge ${event.status}`}>{event.status}</span>
                </div>

                <h3>{event.title}</h3>

                <div className="event-date">
                  📅 {formatDate(event.startDate)}
                </div>

                <p className="event-description">{event.description}</p>

                <div className="event-details">
                  {event.isVirtual ? (
                    <div className="detail-row">
                      <span>🌐 Virtual Event</span>
                    </div>
                  ) : (
                    <div className="detail-row">
                      <span>📍 {event.location || 'TBA'}</span>
                    </div>
                  )}

                  <div className="detail-row">
                    <span>👥 {event.attendeeCount}</span>
                    {event.capacity && <span>/ {event.capacity}</span>}
                  </div>

                  {event.price && (
                    <div className="detail-row">
                      <span>💰 ₹{event.price}</span>
                    </div>
                  )}

                  {getCapacityStatus(event) && (
                    <div className="detail-row capacity">
                      <span>{getCapacityStatus(event)}</span>
                    </div>
                  )}
                </div>

                <div className="event-organizer">
                  <span>By {event.organizerId.name}</span>
                </div>

                <div className="event-actions">
                  {event.status === 'upcoming' && token ? (
                    <>
                      {isUserRsvped(event._id) ? (
                        <>
                          {event.isVirtual && event.virtualLink && (
                            <a
                              href={event.virtualLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                            >
                              Join Virtual
                            </a>
                          )}
                          <button
                            className="btn btn-danger"
                            onClick={() => handleCancelRsvp(event._id)}
                          >
                            Cancel RSVP
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleRsvp(event._id)}
                          disabled={event.capacity && event.attendeeCount >= event.capacity}
                        >
                          + RSVP
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="disabled-text">Event not active</span>
                  )}
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

export default EventsPage;
