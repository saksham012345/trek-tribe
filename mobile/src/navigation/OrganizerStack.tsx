import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, Compass, Users2, CreditCard, PlusCircle } from 'lucide-react-native';

// Screens
import OrganizerDashboardScreen from '../screens/organizer/OrganizerDashboardScreen';
import MyTripsScreen from '../screens/organizer/MyTripsScreen';
import CreateTripWizard from '../screens/organizer/CreateTripWizard';
import LeadManagementScreen from '../screens/organizer/LeadManagementScreen';
import PayoutsScreen from '../screens/organizer/PayoutsScreen';
import VerifyPaymentsScreen from '../screens/organizer/VerifyPaymentsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const OrganizerTabs = () => (
    <Tab.Navigator
        screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#4f46e5', // indigo-600
            tabBarActiveTintColor: '#4f46e5',
            tabBarInactiveTintColor: '#666',
            tabBarStyle: { height: 60, paddingBottom: 10 },
        }}
    >
        <Tab.Screen
            name="Dashboard"
            component={OrganizerDashboardScreen}
            options={{
                tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
            }}
        />
        <Tab.Screen
            name="MyTrips"
            component={MyTripsScreen}
            options={{
                tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
                title: 'Trips'
            }}
        />
        <Tab.Screen
            name="Leads"
            component={LeadManagementScreen}
            options={{
                tabBarIcon: ({ color, size }) => <Users2 color={color} size={size} />,
            }}
        />
        <Tab.Screen
            name="Payouts"
            component={PayoutsScreen}
            options={{
                tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size} />,
            }}
        />
    </Tab.Navigator>
);

const OrganizerStack: React.FC = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OrganizerTabs" component={OrganizerTabs} />
            <Stack.Screen
                name="CreateTrip"
                component={CreateTripWizard}
                options={{
                    headerShown: true,
                    title: 'Create Adventure',
                    headerTintColor: '#4f46e5'
                }}
            />
            <Stack.Screen
                name="VerifyPayments"
                component={VerifyPaymentsScreen}
                options={{
                    headerShown: true,
                    title: 'Verify Payments',
                    headerTintColor: '#4f46e5'
                }}
            />
        </Stack.Navigator>
    );
};

export default OrganizerStack;
