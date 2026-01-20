import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, BookText, MessageSquare, User } from 'lucide-react-native';

// Screens
import DiscoveryScreen from '../screens/traveler/DiscoveryScreen';
import MyBookingsScreen from '../screens/traveler/MyBookingsScreen';
import CommunityScreen from '../screens/traveler/CommunityScreen';
import TravelerProfileScreen from '../screens/traveler/TravelerProfileScreen';
import TripDetailsScreen from '../screens/traveler/TripDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeTabs = () => (
    <Tab.Navigator
        screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#047857',
            tabBarActiveTintColor: '#047857',
            tabBarInactiveTintColor: '#666',
            tabBarStyle: { height: 60, paddingBottom: 10 },
        }}
    >
        <Tab.Screen
            name="Discovery"
            component={DiscoveryScreen}
            options={{
                tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
                title: 'Explore'
            }}
        />
        <Tab.Screen
            name="Bookings"
            component={MyBookingsScreen}
            options={{
                tabBarIcon: ({ color, size }) => <BookText color={color} size={size} />,
                title: 'Trips'
            }}
        />
        <Tab.Screen
            name="Community"
            component={CommunityScreen}
            options={{
                tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
                title: 'Chat'
            }}
        />
        <Tab.Screen
            name="Profile"
            component={TravelerProfileScreen}
            options={{
                tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                title: 'Profile'
            }}
        />
    </Tab.Navigator>
);

const TravelerStack: React.FC = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeTabs" component={HomeTabs} />
            <Stack.Screen
                name="TripDetails"
                component={TripDetailsScreen}
                options={{
                    headerShown: true,
                    title: 'Adventure Details',
                    headerTintColor: '#047857',
                    headerBackTitleVisible: false
                }}
            />
        </Stack.Navigator>
    );
};

export default TravelerStack;
