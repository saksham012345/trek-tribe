import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Rating,
  Pagination,
  Skeleton,
  InputAdornment,
  Autocomplete,
  Slider,
  Collapse,
  IconButton,
  Divider
} from '@mui/material';
import {
  Search,
  LocationOn,
  Star,
  Business,
  Language,
  FilterList,
  ExpandMore,
  ExpandLess,
  Verified
} from '@mui/icons-material';
import { api } from '../services/api';

interface Organizer {
  _id: string;
  name: string;
  bio?: string;
  location?: string;
  profilePhoto?: string;
  uniqueUrl: string;
  organizerProfile?: {
    bio?: string;
    specialties?: string[];
    languages?: string[];
    yearsOfExperience?: number;
    businessInfo?: {
      companyName?: string;
    };
  };
  travelStats?: {
    averageRating: number;
    reviewCount: number;
  };
  socialLinks?: any;
  createdAt: string;
  stats: {
    activeTrips: number;
    upcomingTrips: number;
    totalOrganized: number;
    rating: number;
    reviews: number;
    experience: number;
  };
}

interface SearchFilters {
  q: string;
  location: string;
  specialty: string;
  minRating: number;
  minExperience: number;
  language: string;
}

interface SearchResponse {
  organizers: Organizer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: SearchFilters;
}

const specialtyOptions = [
  'Adventure Travel',
  'Cultural Tours',
  'Nature & Wildlife',
  'Photography Tours',
  'Food & Culinary',
  'Spiritual & Wellness',
  'Historical Sites',
  'Beach & Coastal',
  'Mountain & Hiking',
  'City Tours',
  'Luxury Travel',
  'Budget Travel',
  'Family Friendly',
  'Solo Travel',
  'Group Travel'
];

const languageOptions = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Mandarin',
  'Hindi',
  'Arabic',
  'Russian',
  'Korean',
  'Dutch',
  'Swedish',
  'Norwegian'
];

const OrganizerSearch: React.FC = () => {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<SearchResponse['pagination'] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    q: '',
    location: '',
    specialty: '',
    minRating: 0,
    minExperience: 0,
    language: ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrganizers = async (currentPage = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12'
      });

      // Add non-empty filters to params
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== '' && value !== 0) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/api/public/search/organizers?${params}`);
      const data: SearchResponse = response.data.data;
      
      setOrganizers(data.organizers);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search organizers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const handleSearch = () => {
    const newFilters = { ...filters, q: searchTerm };
    setFilters(newFilters);
    setPage(1);
    fetchOrganizers(1, newFilters);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPage(1);
    fetchOrganizers(1, newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: SearchFilters = {
      q: '',
      location: '',
      specialty: '',
      minRating: 0,
      minExperience: 0,
      language: ''
    };
    setFilters(clearedFilters);
    setSearchTerm('');
    setPage(1);
    fetchOrganizers(1, clearedFilters);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    fetchOrganizers(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderOrganizerCard = (organizer: Organizer) => (
    <Grid item xs={12} sm={6} md={4} key={organizer._id}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              src={organizer.profilePhoto}
              sx={{ width: 60, height: 60, mr: 2 }}
            >
              {organizer.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="h6" component="h3">
                  {organizer.name}
                </Typography>
                <Verified color="primary" sx={{ fontSize: 20, ml: 1 }} />
              </Box>
              {organizer.organizerProfile?.businessInfo?.companyName && (
                <Typography variant="body2" color="text.secondary">
                  {organizer.organizerProfile.businessInfo.companyName}
                </Typography>
              )}
            </Box>
          </Box>

          {organizer.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationOn sx={{ fontSize: 16, mr: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {organizer.location}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Rating value={organizer.stats.rating} precision={0.1} size="small" readOnly />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {organizer.stats.rating.toFixed(1)} ({organizer.stats.reviews} reviews)
            </Typography>
          </Box>

          {organizer.organizerProfile?.bio && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {organizer.organizerProfile.bio.length > 120
                ? `${organizer.organizerProfile.bio.substring(0, 120)}...`
                : organizer.organizerProfile.bio}
            </Typography>
          )}

          {organizer.organizerProfile?.specialties && organizer.organizerProfile.specialties.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Specialties:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {organizer.organizerProfile.specialties.slice(0, 3).map((specialty) => (
                  <Chip key={specialty} label={specialty} size="small" variant="outlined" />
                ))}
                {organizer.organizerProfile.specialties.length > 3 && (
                  <Chip
                    label={`+${organizer.organizerProfile.specialties.length - 3} more`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          )}

          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary" align="center">
                <strong>{organizer.stats.totalOrganized}</strong><br />
                Trips
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary" align="center">
                <strong>{organizer.stats.upcomingTrips}</strong><br />
                Upcoming
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary" align="center">
                <strong>{organizer.stats.experience}y</strong><br />
                Experience
              </Typography>
            </Grid>
          </Grid>

          {organizer.organizerProfile?.languages && organizer.organizerProfile.languages.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Language sx={{ fontSize: 16, mr: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {organizer.organizerProfile.languages.slice(0, 3).join(', ')}
                {organizer.organizerProfile.languages.length > 3 && ` +${organizer.organizerProfile.languages.length - 3} more`}
              </Typography>
            </Box>
          )}
        </CardContent>
        
        <Box sx={{ p: 2, pt: 0 }}>
          <Button
            component={Link}
            to={`/u/${organizer.uniqueUrl}`}
            variant="contained"
            fullWidth
            size="small"
          >
            View Profile
          </Button>
        </Box>
      </Card>
    </Grid>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Find Tour Organizers
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Discover experienced tour organizers for your next adventure
      </Typography>

      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder="Search organizers by name, company, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSearch}
              sx={{ height: '56px' }}
            >
              Search
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setShowFilters(!showFilters)}
              startIcon={<FilterList />}
              endIcon={showFilters ? <ExpandLess /> : <ExpandMore />}
              sx={{ height: '56px' }}
            >
              Filters
            </Button>
          </Grid>
        </Grid>

        <Collapse in={showFilters}>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Location"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                options={specialtyOptions}
                value={filters.specialty}
                onChange={(_, value) => handleFilterChange('specialty', value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Specialty" size="small" />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                options={languageOptions}
                value={filters.language}
                onChange={(_, value) => handleFilterChange('language', value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Language" size="small" />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ px: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Min Rating: {filters.minRating || 'Any'}
                </Typography>
                <Slider
                  value={filters.minRating}
                  onChange={(_, value) => handleFilterChange('minRating', value)}
                  step={0.5}
                  marks
                  min={0}
                  max={5}
                  valueLabelDisplay="auto"
                  size="small"
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ px: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Min Experience: {filters.minExperience || 'Any'} years
                </Typography>
                <Slider
                  value={filters.minExperience}
                  onChange={(_, value) => handleFilterChange('minExperience', value)}
                  step={1}
                  marks
                  min={0}
                  max={20}
                  valueLabelDisplay="auto"
                  size="small"
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button variant="text" onClick={clearFilters} size="small">
                Clear All Filters
              </Button>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Results */}
      {loading ? (
        <Grid container spacing={3}>
          {[...Array(12)].map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Skeleton variant="circular" width={60} height={60} sx={{ mr: 2 }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Skeleton variant="text" width="70%" />
                      <Skeleton variant="text" width="50%" />
                    </Box>
                  </Box>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="60%" />
                  <Box sx={{ mt: 2 }}>
                    <Skeleton variant="rectangular" height={32} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : error ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            {error}
          </Typography>
          <Button onClick={() => fetchOrganizers()} variant="contained" sx={{ mt: 2 }}>
            Try Again
          </Button>
        </Paper>
      ) : organizers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No organizers found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your search criteria or filters
          </Typography>
          <Button onClick={clearFilters} variant="contained">
            Clear Filters
          </Button>
        </Paper>
      ) : (
        <>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Found {pagination?.totalCount} organizers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Page {pagination?.currentPage} of {pagination?.totalPages}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {organizers.map(renderOrganizerCard)}
          </Grid>

          {pagination && pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pagination.totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default OrganizerSearch;