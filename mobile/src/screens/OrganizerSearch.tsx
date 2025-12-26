import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity } from 'react-native';
import { api } from '../api';

interface Organizer {
  _id: string;
  name: string;
  uniqueUrl: string;
  location?: string;
  organizerProfile?: { specialties?: string[] };
  stats: { rating: number; reviews: number };
}

export default function OrganizerSearch({ navigation }: any) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const resp = await api.get(`/api/public/search/organizers`, { params: { q, limit: 20 } });
      setItems(resp.data?.data?.organizers || []);
    } catch (e) {
      // Simple fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Find Tour Organizers</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search organizers"
          style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
        />
        <Button title={loading ? 'Searching...' : 'Search'} onPress={search} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        style={{ marginTop: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { uniqueUrl: item.uniqueUrl })}>
            <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.name}</Text>
              {!!item.location && <Text style={{ color: '#666' }}>{item.location}</Text>}
              <Text style={{ color: '#666' }}>⭐ {item.stats?.rating?.toFixed?.(1) || 0} ({item.stats?.reviews || 0})</Text>
              {!!item.organizerProfile?.specialties?.length && (
                <Text style={{ color: '#666' }}>{item.organizerProfile.specialties.slice(0,3).join(', ')}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
