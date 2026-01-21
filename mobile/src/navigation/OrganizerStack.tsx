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
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react-native';
import { View, Text } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const LockedScreen = ({ title }: { title: string }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Lock size={40} color="#ef4444" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', textAlign: 'center' }}>Premium Feature</Text>
        <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
            Enable AutoPay (Subscription) to access {title} and grow your business.
        </Text>
    </View>
);

const OrganizerTabs = () => {
    const { user } = useAuth();
    const isSubscribed = user?.organizerProfile?.autoPay?.autoPayEnabled === true;

    return (
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
                component={isSubscribed ? LeadManagementScreen : () => <LockedScreen title="Lead Management" />}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <View>
                            <Users2 color={color} size={size} />
                            {!isSubscribed && <View style={{ position: 'absolute', top: -4, right: -4 }}><Lock size={10} color="#ef4444" /></View>}
                        </View>
                    ),
                }}
            />
            <Tab.Screen
                name="Payouts"
                component={isSubscribed ? PayoutsScreen : () => <LockedScreen title="Payouts" />}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <View>
                            <CreditCard color={color} size={size} />
                            {!isSubscribed && <View style={{ position: 'absolute', top: -4, right: -4 }}><Lock size={10} color="#ef4444" /></View>}
                        </View>
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

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
