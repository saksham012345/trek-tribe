import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
}

interface EmergencyContactsProps {
  onUpdate?: () => void;
}

const EmergencyContacts: React.FC<EmergencyContactsProps> = ({ onUpdate }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingContacts, setEditingContacts] = useState<EmergencyContact[]>([]);

  const relationships = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 
    'Colleague', 'Partner', 'Guardian', 'Other'
  ];

  useEffect(() => {
    fetchEmergencyContacts();
  }, []);

  const fetchEmergencyContacts = async () => {
    try {
      const response = await api.get('/auth/emergency-contacts');
      setContacts(response.data.emergencyContacts || []);
      setEditingContacts(response.data.emergencyContacts || []);
    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    const newContact: EmergencyContact = {
      name: '',
      relationship: 'Parent',
      phone: '',
      email: '',
      isPrimary: editingContacts.length === 0
    };
    setEditingContacts([...editingContacts, newContact]);
  };

  const handleRemoveContact = (index: number) => {
    const updatedContacts = editingContacts.filter((_, i) => i !== index);
    setEditingContacts(updatedContacts);
  };

  const handleContactChange = (index: number, field: keyof EmergencyContact, value: string | boolean) => {
    const updatedContacts = editingContacts.map((contact, i) => {
      if (i === index) {
        const updatedContact = { ...contact, [field]: value };
        
        // If marking this contact as primary, unmark others
        if (field === 'isPrimary' && value === true) {
          setEditingContacts(prev => prev.map((c, idx) => ({
            ...c,
            isPrimary: idx === index
          })));
          return updatedContact;
        }
        
        return updatedContact;
      }
      return contact;
    });
    
    if (field !== 'isPrimary') {
      setEditingContacts(updatedContacts);
    }
  };

  const handleSave = async () => {
    try {
      // Validate contacts
      const validContacts = editingContacts.filter(contact => 
        contact.name.trim() && contact.phone.trim()
      );

      if (validContacts.length !== editingContacts.length) {
        alert('Please fill in all required fields (name and phone) or remove incomplete contacts.');
        return;
      }

      const response = await api.put('/auth/emergency-contacts', {
        emergencyContacts: validContacts
      });

      setContacts(response.data.emergencyContacts);
      setIsEditing(false);
      onUpdate && onUpdate();
      alert('Emergency contacts updated successfully!');
    } catch (error: any) {
      console.error('Error updating emergency contacts:', error);
      alert(error.response?.data?.error || 'Failed to update emergency contacts');
    }
  };

  const handleCancel = () => {
    setEditingContacts([...contacts]);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            🚨 Emergency Contacts
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            These contacts will be notified about your trip status and any emergencies
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {contacts.length > 0 ? 'Edit Contacts' : 'Add Contacts'}
          </button>
        )}
      </div>

      {!isEditing ? (
        // Display Mode
        <div>
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">👥</div>
              <p className="text-lg font-medium mb-2">No emergency contacts added yet</p>
              <p className="text-sm">Add emergency contacts to ensure your safety during trips</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-2 ${
                    contact.isPrimary 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                        {contact.isPrimary && (
                          <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">👤</span>
                          <span>{contact.relationship}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📞</span>
                          <span>{contact.phone}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">📧</span>
                            <span>{contact.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Edit Mode
        <div>
          <div className="space-y-4 mb-6">
            {editingContacts.map((contact, index) => (
              <div key={index} className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-medium text-gray-900">Contact {index + 1}</h4>
                  <button
                    onClick={() => handleRemoveContact(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship *
                    </label>
                    <select
                      value={contact.relationship}
                      onChange={(e) => handleContactChange(index, 'relationship', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      {relationships.map(rel => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contact.isPrimary || false}
                      onChange={(e) => handleContactChange(index, 'isPrimary', e.target.checked)}
                      className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Primary contact (will be notified first in emergencies)
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleAddContact}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Add Another Contact
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyContacts;