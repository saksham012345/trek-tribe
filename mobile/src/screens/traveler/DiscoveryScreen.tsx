import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TextInput,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Image,
    StatusBar
} from 'react-native';
import { Search, SlidersHorizontal, Image as ImageIcon, MapPin } from 'lucide-react-native';
import { useTrips } from '../../hooks/useTrips';
import { useNavigation } from '@react-navigation/native';
import TripCard from '../../components/traveler/TripCard';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../theme/DesignSystem';
import GlassCard from '../../components/ui/GlassCard';

const CATEGORIES = ['All', 'Mountain', 'Beach', 'Cultural', 'Spiritual', 'Adventure', 'Wildlife'];

const DiscoveryScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [filters, setFilters] = useState({
        minPrice: undefined as number | undefined,
        maxPrice: undefined as number | undefined,
        difficulty: 'All',
        date: undefined as string | undefined,
    });
    const [showFilters, setShowFilters] = useState(false);

    // Mock data for Posts Preview
    const postsPreview = [
        { id: '1', organizer: 'Alps Explorers', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' },
        { id: '2', organizer: 'Desert King', image: 'https://images.unsplash.com/photo-1509059852496-f3822ae057bf' },
        { id: '3', organizer: 'Beach Vibe', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e' },
    ];

    const {
        trips,
        loading,
        refreshing,
        onRefresh,
        loadMore,
        error
    } = useTrips({
        search,
        category: selectedCategory,
        ...filters
    });

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.welcomeSection}>
                <Text style={styles.greeting}>Hey Explorer! 🏔️</Text>
                <Text style={styles.subGreeting}>Where will your soul wander today?</Text>
            </View>

            {/* Posts/Stories Preview Section */}
            <View style={styles.postsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Tribe Moments</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                        <Text style={styles.seeAllText}>View All</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.postsList}
                >
                    {postsPreview.map(post => (
                        <TouchableOpacity
                            key={post.id}
                            style={styles.postCard}
                            onPress={() => navigation.navigate('Community')}
                        >
                            <Image
                                source={{ uri: post.image }}
                                style={styles.postImage}
                            />
                            <View style={styles.postOverlay}>
                                <Text style={styles.postOrgName} numberOfLines={1}>{post.organizer}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        style={styles.morePostsBtn}
                        onPress={() => navigation.navigate('Community')}
                    >
                        <View style={styles.morePostsCircle}>
                            <ImageIcon size={20} color={COLORS.primary} />
                        </View>
                        <Text style={styles.morePostsText}>+ More</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={styles.searchWrapper}>
                <GlassCard style={styles.searchContainer}>
                    <Search size={20} color={COLORS.textLighter} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search adventures..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={COLORS.textLighter}
                    />
                    <TouchableOpacity
                        style={[styles.filterBtn, (filters.maxPrice || filters.difficulty !== 'All') ? styles.activeFilterBtn : {}]}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <SlidersHorizontal size={20} color={filters.maxPrice || filters.difficulty !== 'All' ? "#fff" : COLORS.primary} />
                    </TouchableOpacity>
                </GlassCard>
            </View>

            {showFilters && (
                <GlassCard style={styles.filterSection}>
                    <Text style={styles.filterTitle}>Quick Filters</Text>
                    <View style={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterChip, filters.maxPrice === 5000 && styles.activeChip]}
                            onPress={() => setFilters(f => ({ ...f, maxPrice: f.maxPrice === 5000 ? undefined : 5000 }))}
                        >
                            <Text style={[styles.filterChipText, filters.maxPrice === 5000 && styles.activeChipText]}>Under ₹5k</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filters.difficulty === 'easy' && styles.activeChip]}
                            onPress={() => setFilters(f => ({ ...f, difficulty: f.difficulty === 'easy' ? 'All' : 'easy' }))}
                        >
                            <Text style={[styles.filterChipText, filters.difficulty === 'easy' && styles.activeChipText]}>Easy Pace</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filters.difficulty === 'hard' && styles.activeChip]}
                            onPress={() => setFilters(f => ({ ...f, difficulty: f.difficulty === 'hard' ? 'All' : 'hard' }))}
                        >
                            <Text style={[styles.filterChipText, filters.difficulty === 'hard' && styles.activeChipText]}>Advanced</Text>
                        </TouchableOpacity>
                    </View>
                </GlassCard>
            )}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
            >
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[
                            styles.categoryChip,
                            selectedCategory === cat && styles.activeCategoryChip
                        ]}
                        onPress={() => setSelectedCategory(cat)}
                    >
                        <Text style={[
                            styles.categoryText,
                            selectedCategory === cat && styles.activeCategoryText
                        ]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );

    const renderFooter = () => {
        if (!loading) return <View style={{ height: 40 }} />;
        return <Loader message="Finding more adventures..." />;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <FlatList
                data={trips}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <TripCard trip={item} />}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={!loading ? (
                    <EmptyState
                        onAction={onRefresh}
                        message={search || selectedCategory !== 'All' ? "Try adjusting your search or filters" : undefined}
                    />
                ) : null}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        paddingBottom: 20,
    },
    header: {
        backgroundColor: '#fff',
        paddingTop: 40,
        paddingBottom: 24,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        ...SHADOWS.lg,
        marginBottom: 20,
    },
    welcomeSection: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    greeting: {
        fontSize: 32,
        fontWeight: '900',
        color: COLORS.text,
        letterSpacing: -0.5,
    },
    subGreeting: {
        fontSize: 16,
        color: COLORS.textLight,
        marginTop: 6,
        fontWeight: '500',
    },
    postsSection: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
    },
    seeAllText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '700',
    },
    postsList: {
        paddingHorizontal: 24,
        gap: 14,
    },
    postCard: {
        width: 120,
        height: 180,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: COLORS.border,
        ...SHADOWS.md,
    },
    postImage: {
        width: '100%',
        height: '100%',
    },
    postOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    postOrgName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
    },
    morePostsBtn: {
        width: 120,
        height: 180,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.primaryLight,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    morePostsCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(15, 118, 110, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    morePostsText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '800',
    },
    searchWrapper: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 4,
        height: 60,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        color: COLORS.text,
        fontWeight: '500',
    },
    filterBtn: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(15, 118, 110, 0.1)',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeFilterBtn: {
        backgroundColor: COLORS.primary,
    },
    filterSection: {
        marginHorizontal: 24,
        marginBottom: 16,
        padding: 16,
    },
    filterTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textLighter,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeChip: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        fontSize: 13,
        color: COLORS.textLight,
        fontWeight: '700',
    },
    activeChipText: {
        color: '#fff',
    },
    categoryList: {
        paddingHorizontal: 24,
        gap: 12,
    },
    categoryChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeCategoryChip: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        ...SHADOWS.colored,
    },
    categoryText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textLight,
    },
    activeCategoryText: {
        color: '#fff',
    },
    errorBanner: {
        backgroundColor: '#fef2f2',
        marginHorizontal: 24,
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default DiscoveryScreen;
