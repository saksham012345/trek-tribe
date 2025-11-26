import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Button,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Rating,
  Divider,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  LocationOn,
  Email,
  Phone,
  Language,
  Business,
  CalendarToday,
  Star,
  Share,
  Message,
  Verified
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import { api } from '../services/api';

interface PublicProfileData {
  user: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    bio?: string;
    location?: string;
    role: 'traveler' | 'organizer';
    profilePhoto?: string;
    coverPhoto?: string;
    uniqueUrl: string;
    socialLinks?: {
      website?: string;
      instagram?: string;
      facebook?: string;
      twitter?: string;
      linkedin?: string;
    };
    organizerProfile?: {
      bio?: string;
      specialties?: string[];
      languages?: string[];
      yearsOfExperience?: number;
      totalTripsOrganized?: number;
      businessInfo?: {
        companyName?: string;
        companyAddress?: string;
        businessLicense?: string;
      };
      certifications?: string[];
    };
    travelStats?: {
      averageRating: number;
      reviewCount: number;
      badges: string[];
    };
    createdAt: string;
  };
  organizedTrips: any[];
  participatedTrips: any[];
  stats: {
    tripsOrganized: number;
    tripsParticipated: number;
    totalParticipants: number;
    averageRating: number;
    reviewCount: number;
    experience: number;
    badges: string[];
  };
  isOrganizer: boolean;
  isOwner?: boolean;
  ownerOnly?: {
    wishlist?: any;
    pastTrips?: any[];
    interestedLeads?: any[];
  };
}

const PublicProfile: React.FC = () => {
  const { uniqueUrl } = useParams<{ uniqueUrl: string }>();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!uniqueUrl) return;
      
      try {
        setLoading(true);
        const response = await api.get(`/api/public/${uniqueUrl}`);
        setProfile(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uniqueUrl]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.user.name}'s Profile - TrekkTribe`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a snackbar notification here
    }
  };

  const renderTripCard = (trip: any, isOrganized = false) => (
    <Card key={trip._id} sx={{ mb: 2, height: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        {trip.coverImage && (
          <Box
            component="img"
            src={trip.coverImage}
            alt={trip.title}
            sx={{
              width: '100%',
              height: 200,
              objectFit: 'cover'
            }}
          />
        )}
        <Chip
          label={trip.difficulty || 'Easy'}
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
        {trip.price && (
          <Chip
            label={`$${trip.price}`}
            color="primary"
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8 }}
          />
        )}
      </Box>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {trip.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {trip.destination}
        </Typography>
        {trip.description && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {trip.description.length > 100
              ? `${trip.description.substring(0, 100)}...`
              : trip.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CalendarToday sx={{ fontSize: 16, mr: 1 }} />
          <Typography variant="body2">
            {format(new Date(trip.startDate), 'MMM dd, yyyy')}
            {trip.endDate && ` - ${format(new Date(trip.endDate), 'MMM dd, yyyy')}`}
          </Typography>
        </Box>
        {!isOrganized && trip.organizerId && (
          <Typography variant="body2" color="text.secondary">
            Organized by {trip.organizerId.name}
          </Typography>
        )}
        {isOrganized && (
          <Typography variant="body2" color="text.secondary">
            {trip.participants?.length || 0} participants
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>
          Loading profile...
        </Typography>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || 'Profile not found'}
          </Typography>
          <Button component={Link} to="/" variant="contained" sx={{ mt: 2 }}>
            Back to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  const { user, stats, isOrganizer, organizedTrips, participatedTrips } = profile;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Cover Photo */}
      {user.coverPhoto && (
        <Box
          sx={{
            height: 300,
            backgroundImage: `url(${user.coverPhoto})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 2,
            mb: 2
          }}
        />
      )}

      {/* Profile Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                isOrganizer && (
                  <Verified color="primary" sx={{ fontSize: 20 }} />
                )
              }
            >
              <Avatar
                src={user.profilePhoto}
                sx={{ width: 120, height: 120 }}
              >
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          </Grid>
          
          <Grid item xs>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="h4" component="h1">
                {user.name}
              </Typography>
              {isOrganizer && (
                <Chip
                  label="Tour Organizer"
                  color="primary"
                  size="small"
                  sx={{ ml: 2 }}
                />
              )}
            </Box>
            
            {user.bio && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.bio}
              </Typography>
            )}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              {user.location && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocationOn sx={{ fontSize: 16, mr: 0.5 }} />
                  <Typography variant="body2">{user.location}</Typography>
                </Box>
              )}
              
              {user.email && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Email sx={{ fontSize: 16, mr: 0.5 }} />
                  <Typography variant="body2">{user.email}</Typography>
                </Box>
              )}
              
              {user.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Phone sx={{ fontSize: 16, mr: 0.5 }} />
                  <Typography variant="body2">{user.phone}</Typography>
                </Box>
              )}
            </Box>

            {/* Social Links */}
            {user.socialLinks && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {Object.entries(user.socialLinks).map(([platform, url]) => {
                  if (!url) return null;
                  return (
                    <Button
                      key={platform}
                      size="small"
                      variant="outlined"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {platform}
                    </Button>
                  );
                })}
              </Box>
            )}

            <Typography variant="body2" color="text.secondary">
              Member since {format(new Date(user.createdAt), 'MMMM yyyy')}
            </Typography>
          </Grid>

          <Grid item>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={handleShare}>
                <Share />
              </IconButton>
              <Button variant="contained" startIcon={<Message />}>
                Contact
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {stats.tripsOrganized + stats.tripsParticipated}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Trips
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <Star sx={{ color: 'gold', mr: 0.5 }} />
                <Typography variant="h4" color="primary">
                  {stats.averageRating.toFixed(1)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Average Rating ({stats.reviewCount} reviews)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {isOrganizer && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {stats.totalParticipants}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Participants
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {stats.experience}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Years Experience
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Organizer Profile Details */}
      {isOrganizer && user.organizerProfile && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            About {user.organizerProfile.businessInfo?.companyName || user.name}
          </Typography>
          
          {user.organizerProfile.bio && (
            <Typography variant="body1" sx={{ mb: 3 }}>
              {user.organizerProfile.bio}
            </Typography>
          )}

          <Grid container spacing={3}>
            {user.organizerProfile.specialties && user.organizerProfile.specialties.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Specialties</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {user.organizerProfile.specialties.map((specialty) => (
                    <Chip key={specialty} label={specialty} variant="outlined" />
                  ))}
                </Box>
              </Grid>
            )}

            {user.organizerProfile.languages && user.organizerProfile.languages.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Languages</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {user.organizerProfile.languages.map((language) => (
                    <Chip key={language} label={language} variant="outlined" />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>

          {user.organizerProfile.businessInfo && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Business Information</Typography>
              <Grid container spacing={2}>
                {user.organizerProfile.businessInfo.companyName && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Business sx={{ mr: 1 }} />
                      <Typography>{user.organizerProfile.businessInfo.companyName}</Typography>
                    </Box>
                  </Grid>
                )}
                {user.organizerProfile.businessInfo.companyAddress && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationOn sx={{ mr: 1 }} />
                      <Typography>{user.organizerProfile.businessInfo.companyAddress}</Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Paper>
      )}

      {/* Badges */}
      {stats.badges && stats.badges.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>Achievements</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {stats.badges.map((badge) => (
              <Chip key={badge} label={badge} color="secondary" />
            ))}
          </Box>
        </Paper>
      )}

      {/* Trips Section */}
      <Paper sx={{ p: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ mb: 3 }}
        >
          {isOrganizer && (
            <Tab label={`Organized Trips (${organizedTrips.length})`} />
          )}
          <Tab label={`Participated Trips (${participatedTrips.length})`} />
        </Tabs>

        {tabValue === 0 && isOrganizer && (
          <Box>
            {organizedTrips.length > 0 ? (
              <Grid container spacing={3}>
                {organizedTrips.map((trip) => (
                  <Grid item xs={12} sm={6} md={4} key={trip._id}>
                    {renderTripCard(trip, true)}
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No organized trips yet
              </Typography>
            )}
          </Box>
        )}

        {((tabValue === 0 && !isOrganizer) || (tabValue === 1)) && (
          <Box>
            {participatedTrips.length > 0 ? (
              <Grid container spacing={3}>
                {participatedTrips.map((trip) => (
                  <Grid item xs={12} sm={6} md={4} key={trip._id}>
                    {renderTripCard(trip)}
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No participated trips yet
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      {/* Owner-only sections: wishlist, past trips, interested leads */}
      {profile.isOwner && profile.ownerOnly && (
        <>
          {/* Wishlist */}
          {profile.ownerOnly.wishlist && profile.ownerOnly.wishlist.wishlistItems && profile.ownerOnly.wishlist.wishlistItems.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h5" gutterBottom>Saved Trips (Wishlist)</Typography>
              <Grid container spacing={3}>
                {profile.ownerOnly.wishlist.wishlistItems.map((item: any) => (
                  <Grid item xs={12} sm={6} md={4} key={item._id}>
                    {renderTripCard({
                      _id: item.trip._id,
                      title: item.trip.title,
                      destination: item.trip.destination,
                      description: item.trip.description,
                      coverImage: item.trip.coverImage,
                      startDate: item.trip.startDate,
                      endDate: item.trip.endDate,
                      price: item.trip.price,
                      organizerId: item.trip.organizerId
                    })}
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Past Trips */}
          {profile.ownerOnly.pastTrips && profile.ownerOnly.pastTrips.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h5" gutterBottom>Past Trips</Typography>
              <Grid container spacing={3}>
                {profile.ownerOnly.pastTrips.map((trip: any) => (
                  <Grid item xs={12} sm={6} md={4} key={trip._id}>
                    {renderTripCard(trip)}
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Interested Trips (leads) */}
          {profile.ownerOnly.interestedLeads && profile.ownerOnly.interestedLeads.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h5" gutterBottom>Interested Trips</Typography>
              <Grid container spacing={3}>
                {profile.ownerOnly.interestedLeads.map((lead: any) => (
                  <Grid item xs={12} sm={6} md={4} key={lead._id}>
                    {lead.tripId ? (
                      renderTripCard({
                        _id: lead.tripId._id,
                        title: lead.tripId.title,
                        destination: lead.tripId.destination,
                        description: lead.tripId.description,
                        coverImage: lead.tripId.coverImage,
                        startDate: lead.tripId.startDate,
                        endDate: lead.tripId.endDate,
                        organizerId: lead.tripId.organizerId
                      })
                    ) : (
                      <Card>
                        <CardContent>
                          <Typography variant="body1">Interested in a trip (details unavailable)</Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
        </>
      )}

    </Container>
  );
};

export default PublicProfile;