import React from 'react';
import { registerRootComponent } from 'expo';
import { AuthProvider } from './contexts/AuthContext';
import RootNavigation from './navigation';

function App() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

registerRootComponent(App);
