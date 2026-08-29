import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Every organizer screen in one place.
//
// Ten screens went in across sprints 3 to 8 and none of them were reachable
// without typing a URL — there is no organizer navigation anywhere in the app.
// Screens nobody can find are the same as screens that were never built, so
// this exists before any more get added.
//
// Entries whose sprint is blocked are listed and disabled rather than hidden.
// A missing item reads as an oversight; a greyed one with a reason reads as a
// decision, and the reason is the useful part.

interface Item {
  label: string;
  to: string;
  blocked?: string;
}

interface Group {
  title: string;
  items: Item[];
}

export const ORGANIZER_NAV: Group[] = [
  {
    title: 'Trips',
    items: [
      { label: 'All trips', to: '/organizer/trips' },
      { label: 'Templates', to: '/organizer/trip-templates' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Profitability', to: '/organizer/analytics/profitability' },
      { label: 'Occupancy', to: '/organizer/analytics/occupancy' },
      { label: 'Customers', to: '/organizer/analytics/customers' },
      { label: 'Marketing', to: '/organizer/analytics/marketing' },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Payouts', to: '/organizer/payouts' },
      { label: 'Cash flow', to: '/organizer/cash-flow' },
      { label: 'Reconciliation', to: '/organizer/reconciliation' },
      { label: 'Settlements', to: '/organizer/settlements' },
      { label: 'Billing', to: '/organizer/subscriptions' },
      {
        label: 'Invoices',
        to: '#',
        blocked: 'Waiting on written CA confirmation of the GST scheme',
      },
      {
        label: 'GST profile',
        to: '#',
        blocked: 'Waiting on written CA confirmation of the GST scheme',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Documents', to: '/organizer/documents' },
      { label: 'Certifications', to: '/organizer/certifications' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Coupons', to: '/organizer/coupons' },
      { label: 'Banners', to: '/organizer/banners' },
    ],
  },
  {
    title: 'AI',
    items: [
      { label: 'Studio', to: '/organizer/ai-studio' },
      { label: 'Marketing', to: '/organizer/ai-marketing' },
      { label: 'Insights', to: '/organizer/ai-insights' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Customers', to: '/organizer/customers' },
      { label: 'Team', to: '/organizer/team' },
      { label: 'Trip leaders', to: '/organizer/leaders' },
      { label: 'CRM', to: '/organizer/crm' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', to: '/organizer/settings' },
      { label: 'Bank & KYC', to: '/organizer/route-onboarding' },
      {
        label: 'Integrations',
        to: '#',
        blocked: 'No requirement traces to this yet — deferred pending a product decision',
      },
    ],
  },
];

const OrganizerNav: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { pathname } = useLocation();

  return (
    <nav className={compact ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6'}>
      {ORGANIZER_NAV.map((group) => (
        <div key={group.title}>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{group.title}</div>
          <ul className="space-y-1">
            {group.items.map((item) =>
              item.blocked ? (
                <li key={item.label}>
                  <span
                    className="text-sm text-gray-400 cursor-help"
                    title={item.blocked}
                  >
                    {item.label}
                    <span className="ml-1 text-xs">·</span>
                  </span>
                </li>
              ) : (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className={
                      'text-sm hover:underline ' +
                      (pathname === item.to
                        ? 'text-green-700 font-medium'
                        : 'text-gray-700 hover:text-gray-900')
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
};

export default OrganizerNav;
