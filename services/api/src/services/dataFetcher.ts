import axios from 'axios';
import { Trip } from '../models/Trip';
import { User } from '../models/User';

interface FetchedTrip {
  id: string;
  title: string;
  description: string;
  destination: string;
  categories: string[];
  price: number;
  duration_days?: number;
  startDate: Date;
  endDate: Date;
  schedule?: Array<{ day: number; title: string; activities: string[] }>;
  images: string[];
  capacity: number;
  paymentConfig?: {
    paymentType: string;
    paymentMethods: string[];
    refundPolicy?: string;
  };
  organizer?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  bestSeason?: string[];
  difficulty?: string;
  status: string;
}

interface FetchedOrganizer {
  id: string;
  name: string;
  email: string;
  profilePhoto?: string;
  location?: string;
  bio?: string;
  specialties?: string[];
  languages?: string[];
  contactEmail?: string;
  contactPhone?: string;
}

export class DataFetcherService {
  private apiBase: string;
  private lastFetchTime: Date | null = null;
  private cachedTrips: FetchedTrip[] = [];
  private cachedOrganizers: FetchedOrganizer[] = [];
  
  constructor() {
    // Use configurable base; defaults to local API
    this.apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
  }

  async fetchAllTrips(): Promise<FetchedTrip[]> {
    try {
      console.log('🔄 Fetching trips from local DB...');
      
      // Fetch directly from database for reliability
      const trips = await Trip.find({ status: { $ne: 'cancelled' } })
        .populate('organizerId', 'name email phone profilePhoto location bio')
        .lean()
        .limit(200);
      
      const fetchedTrips: FetchedTrip[] = trips.map((trip: any) => {
        const organizer = trip.organizerId;
        const durationDays = trip.startDate && trip.endDate 
          ? Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        return {
          id: trip._id.toString(),
          title: trip.title || 'Untitled Trip',
          description: trip.description || '',
          destination: trip.destination || 'Unknown',
          categories: trip.categories || [],
          price: trip.price || 0,
          duration_days: durationDays,
          startDate: trip.startDate,
          endDate: trip.endDate,
          schedule: trip.schedule || [],
          images: trip.images || [],
          capacity: trip.capacity || 10,
          paymentConfig: trip.paymentConfig ? {
            paymentType: trip.paymentConfig.paymentType || 'full',
            paymentMethods: trip.paymentConfig.paymentMethods || ['upi'],
            refundPolicy: trip.paymentConfig.refundPolicy
          } : undefined,
          organizer: organizer ? {
            id: organizer._id?.toString(),
            name: organizer.name,
            email: organizer.email,
            phone: organizer.phone
          } : undefined,
          highlights: [], // Can be extracted from description if needed
          inclusions: [], // Can be added when trip model extends
          exclusions: [],
          bestSeason: [],
          difficulty: undefined,
          status: trip.status || 'active'
        };
      });

      this.cachedTrips = fetchedTrips;
      this.lastFetchTime = new Date();
      console.log(`✅ Fetched ${fetchedTrips.length} trips from database`);
      
      return fetchedTrips;
    } catch (error: any) {
      console.error('❌ Error fetching trips:', error.message);
      // Return cached trips on error
      return this.cachedTrips;
    }
  }

  async fetchAllOrganizers(): Promise<FetchedOrganizer[]> {
    try {
      console.log('🔄 Fetching organizers from local DB...');
      
      // Fetch directly from database
      const organizers = await User.find({ role: 'organizer' })
        .select('name email profilePhoto location bio')
        .lean()
        .limit(100);
      
      const fetchedOrganizers: FetchedOrganizer[] = organizers.map((org: any) => ({
        id: org._id.toString(),
        name: org.name,
        email: org.email,
        profilePhoto: org.profilePhoto,
        location: org.location,
        bio: org.bio,
        specialties: [], // Can be inferred from their trips
        languages: [],
        contactEmail: org.email,
        contactPhone: org.phone
      }));

      this.cachedOrganizers = fetchedOrganizers;
      console.log(`✅ Fetched ${fetchedOrganizers.length} organizers from database`);
      
      return fetchedOrganizers;
    } catch (error: any) {
      console.error('❌ Error fetching organizers:', error.message);
      // Return cached organizers on error
      return this.cachedOrganizers;
    }
  }

  async fetchTripById(tripId: string): Promise<FetchedTrip | null> {
    try {
      const trip = await Trip.findById(tripId)
        .populate('organizerId', 'name email phone profilePhoto location bio')
        .lean();
      
      if (!trip) return null;

      const organizer = trip.organizerId as any;
      const durationDays = trip.startDate && trip.endDate 
        ? Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        id: trip._id.toString(),
        title: trip.title || 'Untitled Trip',
        description: trip.description || '',
        destination: trip.destination || 'Unknown',
        categories: trip.categories || [],
        price: trip.price || 0,
        duration_days: durationDays,
        startDate: trip.startDate,
        endDate: trip.endDate,
        schedule: trip.schedule || [],
        images: trip.images || [],
        capacity: trip.capacity || 10,
        paymentConfig: trip.paymentConfig ? {
          paymentType: trip.paymentConfig.paymentType || 'full',
          paymentMethods: trip.paymentConfig.paymentMethods || ['upi'],
          refundPolicy: trip.paymentConfig.refundPolicy
        } : undefined,
        organizer: organizer ? {
          id: organizer._id?.toString(),
          name: organizer.name,
          email: organizer.email,
          phone: organizer.phone
        } : undefined,
        highlights: [],
        inclusions: [],
        exclusions: [],
        bestSeason: [],
        difficulty: undefined,
        status: trip.status || 'active'
      };
    } catch (error: any) {
      console.error('❌ Error fetching trip by ID:', error.message);
      return null;
    }
  }

  getCachedTrips(): FetchedTrip[] {
    return this.cachedTrips;
  }

  getCachedOrganizers(): FetchedOrganizer[] {
    return this.cachedOrganizers;
  }

  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }

  shouldRefresh(maxAgeMs: number = 2 * 60 * 60 * 1000): boolean {
    // Default: refresh if last fetch was more than 2 hours ago
    if (!this.lastFetchTime) return true;
    return Date.now() - this.lastFetchTime.getTime() > maxAgeMs;
  }
}

// Singleton instance
export const dataFetcherService = new DataFetcherService();
