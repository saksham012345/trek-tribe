import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { Search, Person } from '@mui/icons-material';

const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            TrekkTribe
          </Link>
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="inherit"
            component={Link}
            to="/organizers"
            startIcon={<Search />}
            variant={location.pathname === '/organizers' ? 'outlined' : 'text'}
          >
            Find Organizers
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;