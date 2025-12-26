import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Button } from 'react-native';
import { api } from '../api';

export default function PublicProfile({ route }: any) {
  const { uniqueUrl } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const resp = await api.get(`/api/public/${encodeURIComponent(uniqueUrl)}`);
        setData(resp.data?.data);
      } catch (e: any) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [uniqueUrl]);

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (error || !data) return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: 'red', marginBottom: 8 }}>{error || 'Profile not found'}</Text>
    </View>
  );

  const { user, stats, organizedTrips, participatedTrips } = data;

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>{user.name}</Text>
      {!!user.location && <Text style={{ color: '#666' }}>{user.location}</Text>}
      <Text style={{ marginTop: 6 }}>⭐ {stats.averageRating?.toFixed?.(1) || 0} ({stats.reviewCount || 0} reviews)</Text>
      {!!user.bio && <Text style={{ marginTop: 12 }}>{user.bio}</Text>}

      <Text style={{ marginTop: 16, fontWeight: '600' }}>Trips Organized ({organizedTrips?.length || 0})</Text>
      {(organizedTrips || []).slice(0, 5).map((t: any) => (
        <View key={t._id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontWeight: '500' }}>{t.title}</Text>
          {!!t.destination && <Text style={{ color: '#666' }}>{t.destination}</Text>}
        </View>
      ))}

      <Text style={{ marginTop: 16, fontWeight: '600' }}>Trips Participated ({participatedTrips?.length || 0})</Text>
      {(participatedTrips || []).slice(0, 5).map((t: any) => (
        <View key={t._id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontWeight: '500' }}>{t.title}</Text>
          {!!t.destination && <Text style={{ color: '#666' }}>{t.destination}</Text>}
        </View>
      ))}

      {!!user.email && (
        <View style={{ marginTop: 16 }}>
          <Button title="Contact" onPress={() => { /* deep link mailto */ }} />
        </View>
      )}
    </ScrollView>
  );
}
