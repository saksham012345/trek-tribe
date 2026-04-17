import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: any;
  navigationItems: Array<{name: string, href: string, icon: any}>;
}

export function DashboardLayout({ children, user, navigationItems }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        <div className="h-16 flex items-center px-6 border-b border-gray-100 justify-between">
          <span className="text-xl font-extrabold text-forest-900">TrekTribe <span className="text-[#b4d4b4]">OS</span></span>
          <button className="md:hidden text-gray-500" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = location.pathname.includes(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all
                  ${isActive 
                    ? 'bg-forest-50 text-forest-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-forest-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        {/* User Card */}
        {user && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center font-bold text-forest-700 shrink-0">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full relative z-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex justify-end">
             {/* Future topnav actions (notifications, etc) */}
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
