import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert
} from 'react-native';
import {
    User,
    ShieldCheck,
    Instagram,
    Facebook,
    Globe,
    ChevronRight,
    LogOut,
    Camera,
    MapPin,
    Heart
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/ui/Loader';

const TravelerProfileScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout }
            ]
        );
    };

    const completeness = 65; // Mock data

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Profile Header */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde' }}
                        style={styles.avatar}
                    />
                    <TouchableOpacity style={styles.cameraBtn}>
                        <Camera size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.userName}>{user?.name || 'Traveler'}</Text>
                <View style={styles.verifiedRow}>
                    <ShieldCheck size={16} color="#059669" />
                    <Text style={styles.verifiedText}>Verified Traveler</Text>
                </View>
            </View>

            {/* Profile Completeness */}
            <View style={styles.card}>
                <View style={styles.completenessHeader}>
                    <Text style={styles.cardTitle}>Profile Completeness</Text>
                    <Text style={styles.completenessPercent}>{completeness}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${completeness}%` }]} />
                </View>
                <Text style={styles.completenessTip}>Add your ID proof to reach 100%</Text>
            </View>

            {/* Social Links */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Connected Accounts</Text>
                <View style={styles.socialGrid}>
                    <TouchableOpacity style={styles.socialBtn}>
                        <Instagram size={20} color="#E1306C" />
                        <Text style={styles.socialLabel}>Instagram</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialBtn}>
                        <Facebook size={20} color="#1877F2" />
                        <Text style={styles.socialLabel}>Facebook</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialBtn}>
                        <Globe size={20} color="#6b7280" />
                        <Text style={styles.socialLabel}>Website</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Settings List */}
            <View style={styles.settingsList}>
                <TouchableOpacity style={styles.settingsItem}>
                    <View style={[styles.settingsIcon, { backgroundColor: '#f0fdf4' }]}>
                        <User size={20} color="#047857" />
                    </View>
                    <Text style={styles.settingsText}>Personal Information</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsItem}>
                    <View style={[styles.settingsIcon, { backgroundColor: '#fef2f2' }]}>
                        <Heart size={20} color="#dc2626" />
                    </View>
                    <Text style={styles.settingsText}>Interests & Preferences</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsItem}>
                    <View style={[styles.settingsIcon, { backgroundColor: '#eff6ff' }]}>
                        <ShieldCheck size={20} color="#2563eb" />
                    </View>
                    <Text style={styles.settingsText}>Identity Verification</Text>
                    <View style={styles.badgePending}>
                        <Text style={styles.badgeText}>Action Required</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsItem} onPress={handleLogout}>
                    <View style={[styles.settingsIcon, { backgroundColor: '#f9fafb' }]}>
                        <LogOut size={20} color="#6b7280" />
                    </View>
                    <Text style={[styles.settingsText, { color: '#dc2626' }]}>Logout</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.versionText}>Version 1.0.0 (BETA)</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#fff',
    },
    avatarContainer: {
        padding: 4,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: '#047857',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#047857',
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#fff',
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    verifiedText: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '600',
    },
    card: {
        marginHorizontal: 20,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 32,
    },
    completenessHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    completenessPercent: {
        fontSize: 18,
        fontWeight: '800',
        color: '#047857',
    },
    progressBarBg: {
        height: 10,
        backgroundColor: '#f3f4f6',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#047857',
        borderRadius: 5,
    },
    completenessTip: {
        fontSize: 12,
        color: '#6b7280',
        fontStyle: 'italic',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    socialGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    socialBtn: {
        flex: 0.3,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    socialLabel: {
        fontSize: 12,
        color: '#4b5563',
        fontWeight: '600',
        marginTop: 8,
    },
    settingsList: {
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    settingsIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingsText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    badgePending: {
        backgroundColor: '#fff7ed',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#ea580c',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    versionText: {
        fontSize: 12,
        color: '#9ca3af',
    },
});

export default TravelerProfileScreen;
