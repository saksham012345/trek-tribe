import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

interface Trip {
    _id: string;
    title: string;
    destination: string;
    price: number;
    startDate: string;
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    coverImage: string;
    categories: string[];
}

interface UseTripsProps {
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    difficulty?: string;
    date?: string;
    limit?: number;
}

export const useTrips = ({ search, category, minPrice, maxPrice, difficulty, date, limit = 10 }: UseTripsProps) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrips = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
        if (loading || (!hasMore && !isRefresh)) return;

        setLoading(true);
        setError(null);

        try {
            const params = {
                page: pageNum,
                limit,
                search: search || undefined,
                category: category !== 'All' ? category : undefined,
                minPrice,
                maxPrice,
                difficulty: difficulty !== 'All' ? difficulty : undefined,
                date,
            };

            const response = await apiClient.get('/trips', { params });
            const newTrips = response.data.trips || response.data; // Handle different API response shapes

            if (isRefresh) {
                setTrips(newTrips);
            } else {
                setTrips(prev => [...prev, ...newTrips]);
            }

            setHasMore(newTrips.length === limit);
            setPage(pageNum);
        } catch (err: any) {
            console.error('Failed to fetch trips:', err);
            setError('Could not load trips. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [search, category, minPrice, maxPrice, difficulty, date, limit, hasMore, loading]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchTrips(1, true);
    }, [search, category, minPrice, maxPrice, difficulty, date]);

    const onRefresh = () => {
        setRefreshing(true);
        setHasMore(true);
        fetchTrips(1, true);
    };

    const loadMore = () => {
        if (hasMore && !loading) {
            fetchTrips(page + 1);
        }
    };

    return { trips, loading, refreshing, onRefresh, loadMore, error };
};
