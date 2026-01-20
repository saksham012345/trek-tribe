import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Image,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Share,
    Alert,
    FlatList
} from 'react-native';
import {
    MapPin,
    Calendar,
    Users,
    CheckCircle2,
    ChevronRight,
    Share2,
    ArrowLeft,
    Download,
    ShieldCheck
} from 'lucide-react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import JoinTripModal from '../../components/traveler/JoinTripModal';

const { width } = Dimensions.get('window');

const TripDetailsScreen: React.FC = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { id } = route.params;

    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(0);
    const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);

    useEffect(() => {
        fetchTripDetails();
    }, [id]);

    const fetchTripDetails = async () => {
        try {
            const response = await apiClient.get(`/trips/${id}`);
            setTrip(response.data.trip || response.data);
        } catch (error) {
            console.error('Failed to fetch trip details:', error);
            Alert.alert('Error', 'Could not load trip details');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this amazing adventure: ${trip.title} at ${trip.destination}!`,
                url: `https://trektribe.in/trips/${id}`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    if (loading) return <Loader fullScreen message="Preparing your adventure..." />;
    if (!trip) return <View style={styles.errorContainer}><Text>Trip not found</Text></View>;

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Image Carousel */}
                <View style={styles.carouselContainer}>
                    {trip.images && trip.images.length > 0 ? (
                        <FlatList
                            data={trip.images}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }: { item: string }) => (
                                <Image source={{ uri: item }} style={styles.mainImage} />
                            )}
                            keyExtractor={(_item: string, index: number) => index.toString()}
                        />
                    ) : (
                        <Image
                            source={{ uri: trip.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' }}
                            style={styles.mainImage}
                        />
                    )}
                    <View style={styles.imageOverlay}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                            <ArrowLeft size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                            <Share2 size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.title}>{trip.title}</Text>
                        <View style={styles.locationRow}>
                            <MapPin size={18} color="#047857" />
                            <Text style={styles.locationText}>{trip.destination}</Text>
                        </View>
                    </View>

                    <View style={styles.statsCard}>
                        <View style={styles.statItem}>
                            <Calendar size={20} color="#047857" />
                            <View>
                                <Text style={styles.statLabel}>Duration</Text>
                                <Text style={styles.statValue}>
                                    {Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))} Days
                                </Text>
                            </View>
                        </View>
                        <View style={styles.statLine} />
                        <View style={styles.statItem}>
                            <Users size={20} color="#047857" />
                            <View>
                                <Text style={styles.statLabel}>Group Size</Text>
                                <Text style={styles.statValue}>{trip.capacity || 0} Max</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <Text style={styles.description}>{trip.description}</Text>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Day-wise Itinerary</Text>
                            <TouchableOpacity>
                                <Download size={20} color="#047857" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.itineraryContainer}>
                            {(trip.schedule || trip.itinerary)?.map((day: any, index: number) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.dayCard, activeDay === index && styles.activeDayCard]}
                                    onPress={() => setActiveDay(index)}
                                >
                                    <View style={styles.dayHeader}>
                                        <Text style={[styles.dayNumber, activeDay === index && styles.activeDayText]}>
                                            Day {day.day || index + 1}
                                        </Text>
                                        <Text style={styles.dayTitle}>{day.title}</Text>
                                        <ChevronRight size={18} color={activeDay === index ? "#047857" : "#666"} />
                                    </View>
                                    {activeDay === index && (
                                        <View style={styles.dayDetails}>
                                            {day.activities ? (
                                                day.activities.map((act: string, idx: number) => (
                                                    <View key={idx} style={styles.activityItem}>
                                                        <View style={styles.dot} />
                                                        <Text style={styles.activityText}>{act}</Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.activityText}>{day.description}</Text>
                                            )}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>What's Included</Text>
                        <View style={styles.inclusionGrid}>
                            {(trip.categories || ['Adventure', 'Guidance']).map((item: string, i: number) => (
                                <View key={i} style={styles.inclusionItem}>
                                    <CheckCircle2 size={18} color="#059669" />
                                    <Text style={styles.inclusionText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Sticky Bottom Booking Bar */}
            <View style={styles.footer}>
                <View>
                    <Text style={styles.footerPriceLabel}>Total Price</Text>
                    <Text style={styles.footerPrice}>₹{trip.price.toLocaleString()}</Text>
                </View>
                <TouchableOpacity style={styles.bookBtn} onPress={() => setIsJoinModalVisible(true)}>
                    <Text style={styles.bookBtnText}>Join Adventure</Text>
                </TouchableOpacity>
            </View>

            <JoinTripModal
                trip={trip}
                isVisible={isJoinModalVisible}
                onClose={() => setIsJoinModalVisible(false)}
                onSuccess={() => {
                    Alert.alert('Success', 'Booking request submitted!');
                    fetchTripDetails();
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    carouselContainer: {
        width: width,
        height: 300,
    },
    mainImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f3f4f6',
    },
    imageOverlay: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        marginTop: -30,
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    headerInfo: {
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 10,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: '#f0fdf4',
        borderRadius: 20,
        padding: 20,
        marginBottom: 32,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statLine: {
        width: 1,
        height: 40,
        backgroundColor: '#bbf7d0',
    },
    statLabel: {
        fontSize: 12,
        color: '#065f46',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#065f46',
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        color: '#4b5563',
        lineHeight: 24,
    },
    itineraryContainer: {
        gap: 12,
    },
    dayCard: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        padding: 16,
        backgroundColor: '#f9fafb',
    },
    activeDayCard: {
        borderColor: '#047857',
        backgroundColor: '#f0fdf4',
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dayNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6b7280',
    },
    activeDayText: {
        color: '#047857',
    },
    dayTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    dayDetails: {
        marginTop: 16,
        paddingLeft: 4,
        gap: 10,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#047857',
    },
    activityText: {
        fontSize: 14,
        color: '#4b5563',
    },
    inclusionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    inclusionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    inclusionText: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 90,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 20,
    },
    footerPriceLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    footerPrice: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },
    bookBtn: {
        backgroundColor: '#047857',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
    },
    bookBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default TripDetailsScreen;
