import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Mail, Lock, User, Briefcase, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';

const RegisterScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { login } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'traveler' | 'organizer'>('traveler');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post('/auth/register', {
                name,
                email,
                password,
                role
            });

            const { token, user } = response.data;

            // Auto-login after registration
            await login(token, user);

        } catch (error: any) {
            console.error('Registration failed:', error);
            const message = error.response?.data?.message || 'Registration failed. Please try again.';
            Alert.alert('Registration Error', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ChevronLeft size={24} color="#047857" />
                    <Text style={styles.backButtonText}>Back to Login</Text>
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Choose your path and start your journey</Text>
                </View>

                <View style={styles.roleContainer}>
                    <TouchableOpacity
                        style={[styles.roleBox, role === 'traveler' && styles.activeRole]}
                        onPress={() => setRole('traveler')}
                    >
                        <User size={32} color={role === 'traveler' ? '#047857' : '#999'} />
                        <Text style={[styles.roleText, role === 'traveler' && styles.activeRoleText]}>Traveler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.roleBox, role === 'organizer' && styles.activeRole]}
                        onPress={() => setRole('organizer')}
                    >
                        <Briefcase size={32} color={role === 'organizer' ? '#047857' : '#999'} />
                        <Text style={[styles.roleText, role === 'organizer' && styles.activeRoleText]}>Organizer</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputContainer}>
                        <User size={20} color="#666" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#999"
                        />
                    </View>

                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputContainer}>
                        <Mail size={20} color="#666" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputContainer}>
                        <Lock size={20} color="#666" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Create a password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor="#999"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.registerButton}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader color="#fff" />
                        ) : (
                            <Text style={styles.registerButtonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    backButtonText: {
        color: '#047857',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 4,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#047857',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    roleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    roleBox: {
        flex: 0.48,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    activeRole: {
        borderColor: '#047857',
        backgroundColor: '#f0fdf4',
    },
    roleText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
    },
    activeRoleText: {
        color: '#047857',
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        marginBottom: 20,
        paddingHorizontal: 12,
        height: 56,
        backgroundColor: '#f9fafb',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
    },
    registerButton: {
        backgroundColor: '#047857',
        borderRadius: 12,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#047857',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default RegisterScreen;
