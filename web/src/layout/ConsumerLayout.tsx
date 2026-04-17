import React from 'react';
import BottomNav from '../components/BottomNav';

interface ConsumerLayoutProps {
  children: React.ReactNode;
  user?: any;
  showBottomNav?: boolean;
}

export function ConsumerLayout({ children, user, showBottomNav = true }: ConsumerLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex justify-center w-full font-sans">
      <div className="w-full max-w-7xl mx-auto md:bg-transparent bg-white relative min-h-screen flex flex-col">
        
        <main className="flex-1 w-full pb-24 md:pb-8">
          {children}
        </main>
        
        {showBottomNav && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
             <BottomNav user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
