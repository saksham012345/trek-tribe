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
    Image
} from 'react-native';
import { Search, Filter, SlidersHorizontal, LayoutGrid, Image as ImageIcon } from 'lucide-react-native';
import { useTrips } from '../../hooks/useTrips';
import { useNavigation } from '@react-navigation/native';
import TripCard from '../../components/traveler/TripCard';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

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
                <Text style={styles.greeting}>Hey Explorer!</Text>
                <Text style={styles.subGreeting}>Ready for your next adventure?</Text>
            </View>

            {/* Posts/Stories Preview Section */}
            <View style={styles.postsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Moments from Organizers</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                        <Text style={styles.seeAllText}>View Feed</Text>
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
                            <ImageIcon size={20} color="#047857" />
                        </View>
                        <Text style={styles.morePostsText}>See More</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={styles.searchContainer}>
                <Search size={20} color="#6b7280" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Where to next?"
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                    style={[styles.filterBtn, (filters.maxPrice || filters.difficulty !== 'All') ? styles.activeFilterBtn : {}]}
                    onPress={() => setShowFilters(!showFilters)}
                >
                    <SlidersHorizontal size={20} color={filters.maxPrice || filters.difficulty !== 'All' ? "#fff" : "#047857"} />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={styles.filterSection}>
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
                            <Text style={[styles.filterChipText, filters.difficulty === 'hard' && styles.activeChipText]}>Challenging</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />
                }
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    listContent: {
        paddingBottom: 20,
    },
    header: {
        backgroundColor: '#fff',
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 20,
    },
    welcomeSection: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    greeting: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111827',
    },
    subGreeting: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 4,
    },
    postsSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    seeAllText: {
        fontSize: 14,
        color: '#047857',
        fontWeight: '600',
    },
    postsList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    postCard: {
        width: 110,
        height: 160,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
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
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    postOrgName: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    morePostsBtn: {
        width: 110,
        height: 160,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    morePostsCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    morePostsText: {
        fontSize: 12,
        color: '#047857',
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        borderRadius: 16,
        height: 52,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    filterBtn: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    activeFilterBtn: {
        backgroundColor: '#047857',
    },
    filterSection: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
    },
    filterTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    activeChip: {
        backgroundColor: '#047857',
        borderColor: '#047857',
    },
    filterChipText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    activeChipText: {
        color: '#fff',
    },
    categoryList: {
        paddingHorizontal: 16,
        gap: 10,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeCategoryChip: {
        backgroundColor: '#047857',
        borderColor: '#047857',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    activeCategoryText: {
        color: '#fff',
    },
    errorBanner: {
        backgroundColor: '#fef2f2',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '500',
    },
});

export default DiscoveryScreen;
