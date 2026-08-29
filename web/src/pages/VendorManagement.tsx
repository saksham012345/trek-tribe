import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, Receipt, Mail, LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import VendorOSShowcase from '../components/vendor-management/VendorOSShowcase';
import VendorsPanel from '../components/vendor-management/VendorsPanel';
import AssignmentsPanel from '../components/vendor-management/AssignmentsPanel';
import CommunicationsPanel from '../components/vendor-management/CommunicationsPanel';

type Tab = 'vendors' | 'assignments' | 'communications';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'vendors', label: 'Vendors', icon: Tag },
  { id: 'assignments', label: 'Trip Assignments & Payments', icon: Receipt },
  { id: 'communications', label: 'Communications', icon: Mail },
];

const VendorManagement: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('vendors');

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <VendorOSShowcase />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {t.label}
                {active && (
                  <motion.div
                    layoutId="vendor-tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-600"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {tab === 'vendors' && <VendorsPanel />}
            {tab === 'assignments' && <AssignmentsPanel />}
            {tab === 'communications' && <CommunicationsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VendorManagement;
