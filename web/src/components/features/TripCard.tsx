import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import SaveTripButton from '../SaveTripButton';
import SocialShareButtons from '../SocialShareButtons';

export interface TripCardProps {
  trip: any; // Using any for simplicity here, in real app import Trip type
  user: any;
  onJoinClick: (trip: any) => void;
  onLeaveClick: (tripId: string) => void;
}

export function TripCard({ trip, user, onJoinClick, onLeaveClick }: TripCardProps) {
  
  const tripEmoji = (cats: string[]) => {
    if (cats?.includes('Mountain')) return '🏔️';
    if (cats?.includes('Nature')) return '🌲';
    if (cats?.includes('Beach')) return '🏖️';
    if (cats?.includes('Cultural')) return '🏛️';
    return '🌍';
  };

  const isLeaving = trip.participants?.includes(user?.id || '');
  const isFull = (trip.participants?.length || 0) >= trip.capacity;

  return (
    <Card padding="none" interactive className="flex flex-col overflow-hidden relative">
      {/* Image Area */}
      <div className="relative h-56 md:h-64 overflow-hidden bg-gray-100 cursor-pointer" onClick={() => window.location.href = `/trip/${trip._id}`}>
        {(trip.coverImage || trip.images?.length > 0) ? (
          <img src={trip.coverImage || trip.images[0]} alt={trip.title} className="w-full h-full object-cover rounded-t-3xl transition-transform duration-700 ease-out hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fb = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fb) fb.style.display = 'flex';
            }} />
        ) : null}
        
        {/* Fallback Emoji BG */}
        <div className={`absolute inset-0 bg-gradient-to-br from-forest-500 to-[#b4d4b4] items-center justify-center ${(trip.coverImage || trip.images?.length > 0) ? 'hidden' : 'flex'}`}>
          <div className="text-center text-forest-900 p-4">
            <div className="text-6xl mb-2 drop-shadow-md">{tripEmoji(trip.categories)}</div>
            <p className="text-sm font-bold opacity-90 tracking-wide uppercase">{trip.categories?.[0] || 'Adventure'}</p>
          </div>
        </div>
        
        {/* Floating Actions Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          <SaveTripButton tripId={trip._id} size="md" className="z-10 shadow-[0_4px_12px_rgb(0,0,0,0.1)] rounded-full backdrop-blur-md bg-white/90" />
        </div>
        
        {/* Price Tag */}
        <div className="absolute top-4 left-0">
          <div className="bg-white/95 backdrop-blur-sm rounded-r-2xl px-4 py-1.5 text-forest-900 text-sm font-extrabold shadow-sm flex items-center gap-1 border border-white/20">
            Rs.{trip.price.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="p-5 md:p-6 flex-1 flex flex-col relative z-20 bg-white">
        <div className="flex justify-between items-start mb-2">
          <Link to={`/trip/${trip._id}`} className="text-xl md:text-2xl font-extrabold text-gray-900 line-clamp-1 hover:text-forest-600 transition-colors">
            {trip.title}
          </Link>
        </div>
        
        <Badge variant="brand" className="mb-4 w-fit flex items-center gap-1.5">
          <MapPin className="w-3 h-3"/> {trip.destination}
        </Badge>
        
        <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed font-medium">
          {trip.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="neutral" className="flex items-center gap-1.5 text-gray-600 font-bold">
            <Calendar className="w-3.5 h-3.5 text-gray-400"/> 
            {new Date(trip.startDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
          </Badge>
          <Badge variant="neutral" className="flex items-center gap-1.5 text-gray-600 font-bold">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            {trip.participants?.length || 0}/{trip.capacity} spots
          </Badge>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-auto pt-5 border-t border-gray-100 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => window.location.href = `/trip/${trip._id}`} className="flex-1">
            Details
          </Button>
          
          {isLeaving ? (
            <Button variant="danger" className="flex-[1.5]" onClick={() => onLeaveClick(trip._id)}>
              Leave Trip
            </Button>
          ) : isFull ? (
            <Button variant="ghost" disabled className="flex-[1.5]">
              Fully Booked
            </Button>
          ) : (
            <Button variant="primary" className="flex-[1.5] shadow-[0_8px_16px_rgb(20,83,45,0.2)] text-[#b4d4b4] hover:text-white" onClick={() => onJoinClick(trip)}>
              Book Now
            </Button>
          )}
          
          <div className="bg-gray-50 rounded-2xl border border-gray-200 hover:bg-gray-100 transition-colors">
            <SocialShareButtons tripId={trip._id} tripTitle={trip.title} tripDescription={trip.description} variant="icon-only" />
          </div>
        </div>
      </div>
    </Card>
  );
}
