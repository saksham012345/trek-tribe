import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

// Stacks
import AuthStack from './AuthStack';
import TravelerStack from './TravelerStack';
import OrganizerStack from './OrganizerStack';

// Loading Component
import Loader from '../components/ui/Loader';

const Stack = createNativeStackNavigator();

/**
 * Root Navigation Controller
 * Implements Role-Based Guards:
 * - Not logged in: Show AuthStack
 * - Logged in as Traveler: Show TravelerStack
 * - Logged in as Organizer: Show OrganizerStack
 */
const RootNavigation: React.FC = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <Loader fullScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                {!user ? (
                    // 🔐 Public Authenticated Layer
                    <Stack.Screen name="Auth" component={AuthStack} />
                ) : user.role === 'organizer' ? (
                    // 🏔️ Organizer-Only Layer (Guarded)
                    <Stack.Screen name="OrganizerApp" component={OrganizerStack} />
                ) : (
                    // 🎒 Traveler-Only Layer (Guarded)
                    <Stack.Screen name="TravelerApp" component={TravelerStack} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default RootNavigation;
