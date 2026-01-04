import React, { useState, useEffect, useRef } from 'react';
import './LiveActivityTicker.css';
import io from 'socket.io-client';

interface ActivityEvent {
    id: string;
    message: string;
    type: 'booking' | 'trip' | 'user' | 'review';
    timestamp: Date;
}

const LiveActivityTicker: React.FC = () => {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const socketRef = useRef<any>(null);

    // Simulated events for demo if socket is quiet
    const demoEvents = [
        { id: 'd1', message: '🚀 New trip to Manali just added!', type: 'trip' },
        { id: 'd2', message: '👤 Rahul just joined the tribe.', type: 'user' },
        { id: 'd3', message: '⭐ 5-star review received for "Kasol Trek"', type: 'review' },
        { id: 'd4', message: '🎫 New booking for "Goa Beach Bash"', type: 'booking' }
    ] as const;

    useEffect(() => {
        // Connect to socket
        const socketUrl = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || window.location.origin.replace('/api', '');
        socketRef.current = io(socketUrl, { path: '/socket.io/' });

        socketRef.current.on('public_activity', (data: any) => {
            const newEvent: ActivityEvent = {
                id: Date.now().toString(),
                message: data.message,
                type: data.type || 'trip',
                timestamp: new Date()
            };
            setEvents(prev => [newEvent, ...prev].slice(0, 10)); // Keep last 10
        });

        // Initialize with demo events staggered
        let demoIdx = 0;
        const interval = setInterval(() => {
            if (demoIdx < demoEvents.length) {
                const e = demoEvents[demoIdx];
                setEvents(prev => [{ ...e, id: Date.now().toString(), timestamp: new Date() }, ...prev].slice(0, 10));
                demoIdx++;
                if (demoIdx >= demoEvents.length) demoIdx = 0; // Loop demo events
            }
        }, 8000); // Add new event every 8 seconds

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (events.length === 0) return;

        // Rotate displayed event
        const interval = setInterval(() => {
            setCurrentEventIndex(prev => (prev + 1) % events.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [events.length]);

    if (events.length === 0) return null;

    const currentEvent = events[currentEventIndex];

    return (
        <div className="live-ticker-container">
            <div className="ticker-label">
                <span className="live-dot"></span> LIVE
            </div>
            <div className="ticker-content fade-key-{currentEvent.id}">
                {currentEvent.message}
            </div>
        </div>
    );
};

export default LiveActivityTicker;
