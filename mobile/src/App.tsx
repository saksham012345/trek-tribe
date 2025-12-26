import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrganizerSearch from './screens/OrganizerSearch';
import PublicProfile from './screens/PublicProfile';
import { StatusBar } from 'expo-status-bar';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator>
        <Stack.Screen name="Organizers" component={OrganizerSearch} />
        <Stack.Screen name="Profile" component={PublicProfile} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
