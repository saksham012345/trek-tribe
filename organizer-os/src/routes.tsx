import React from 'react';

/**
 * Every organizer screen, and where it lives in the main web app.
 *
 * Kept as one table rather than scattered through the router so the set is
 * countable: if a screen exists it is on this list, and if it is on this list
 * the navigation can reach it. The paths match the ones the main site uses, so
 * a URL copied from there opens the same screen here.
 *
 * Lazy, because the vendor screens pull in three.js and nobody should wait for
 * that to look at a coupon.
 */
export interface OrganizerRoute {
  path: string;
  element: React.ReactNode;
}

const OrganizerDashboard = React.lazy(() => import('@web/pages/OrganizerDashboard'));
const TripsManage = React.lazy(() => import('@web/pages/organizer-os/TripsManage'));
const OpsConsole = React.lazy(() => import('@web/pages/organizer-os/OpsConsole'));
const TripFinancePage = React.lazy(() => import('@web/pages/TripFinancePage'));
const TripTemplates = React.lazy(() => import('@web/pages/organizer-os/TripTemplates'));
const BookingsList = React.lazy(() => import('@web/pages/organizer-os/BookingsList'));
const AnalyticsOverview = React.lazy(() => import('@web/pages/organizer-os/AnalyticsOverview'));
const AnalyticsProfitability = React.lazy(() => import('@web/pages/organizer-os/AnalyticsProfitability'));
const AnalyticsOccupancy = React.lazy(() => import('@web/pages/organizer-os/AnalyticsOccupancy'));
const AnalyticsCustomers = React.lazy(() => import('@web/pages/organizer-os/AnalyticsCustomers'));
const AnalyticsMarketing = React.lazy(() => import('@web/pages/organizer-os/AnalyticsMarketing'));
const Payouts = React.lazy(() => import('@web/pages/organizer-os/Payouts'));
const CashFlow = React.lazy(() => import('@web/pages/organizer-os/CashFlow'));
const Reconciliation = React.lazy(() => import('@web/pages/organizer-os/Reconciliation'));
const OrganizerSettlements = React.lazy(() => import('@web/pages/OrganizerSettlements'));
const Subscribe = React.lazy(() => import('@web/pages/Subscribe'));
const BankDetails = React.lazy(() => import('@web/pages/organizer-os/BankDetails'));
const OpsDocuments = React.lazy(() => import('@web/pages/organizer-os/OpsDocuments'));
const Certifications = React.lazy(() => import('@web/pages/organizer-os/Certifications'));
const Coupons = React.lazy(() => import('@web/pages/organizer-os/Coupons'));
const DiscountRules = React.lazy(() => import('@web/pages/organizer-os/DiscountRules'));
const Campaigns = React.lazy(() => import('@web/pages/organizer-os/Campaigns'));
const Banners = React.lazy(() => import('@web/pages/organizer-os/Banners'));
const Referrals = React.lazy(() => import('@web/pages/organizer-os/Referrals'));
const ReviewRequests = React.lazy(() => import('@web/pages/organizer-os/ReviewRequests'));
const AiStudio = React.lazy(() => import('@web/pages/organizer-os/AiStudio'));
const AiMarketing = React.lazy(() => import('@web/pages/organizer-os/AiMarketing'));
const AiInsights = React.lazy(() => import('@web/pages/organizer-os/AiInsights'));
const CrmCustomers = React.lazy(() => import('@web/pages/organizer-os/CrmCustomers'));
const Leads = React.lazy(() => import('@web/pages/organizer-os/Leads'));
const CRMDashboard = React.lazy(() => import('@web/pages/CRMDashboard'));
const Team = React.lazy(() => import('@web/pages/organizer-os/Team'));
const Leaders = React.lazy(() => import('@web/pages/organizer-os/Leaders'));
const VendorManagement = React.lazy(() => import('@web/pages/VendorManagement'));
const PaymentVerificationDashboard = React.lazy(() => import('@web/pages/PaymentVerificationDashboard'));
const OrganizerSettings = React.lazy(() => import('@web/pages/organizer-os/OrganizerSettings'));

const lazily = (node: React.ReactNode) => (
  <React.Suspense fallback={<div className="p-10 text-gray-500">Loading…</div>}>{node}</React.Suspense>
);

/**
 * OrganizerDashboard is the one screen that takes the user as a prop rather
 * than reading it from context — the main app passes it at the route. Missing
 * that here rendered the dashboard with user undefined and it threw on
 * user.name, so the table is built from the user rather than being a constant.
 */
export const organizerRoutes = (user: any): OrganizerRoute[] => [
  { path: '/organizer', element: lazily(<OrganizerDashboard user={user} />) },
  { path: '/organizer/trips', element: lazily(<TripsManage />) },
  { path: '/organizer/trips/:tripId/ops', element: lazily(<OpsConsole />) },
  { path: '/organizer/trips/:tripId/finance', element: lazily(<TripFinancePage />) },
  { path: '/organizer/trip-templates', element: lazily(<TripTemplates />) },
  { path: '/organizer/bookings', element: lazily(<BookingsList />) },
  { path: '/organizer/analytics', element: lazily(<AnalyticsOverview />) },
  { path: '/organizer/analytics/profitability', element: lazily(<AnalyticsProfitability />) },
  { path: '/organizer/analytics/occupancy', element: lazily(<AnalyticsOccupancy />) },
  { path: '/organizer/analytics/customers', element: lazily(<AnalyticsCustomers />) },
  { path: '/organizer/analytics/marketing', element: lazily(<AnalyticsMarketing />) },
  { path: '/organizer/payouts', element: lazily(<Payouts />) },
  { path: '/organizer/cash-flow', element: lazily(<CashFlow />) },
  { path: '/organizer/reconciliation', element: lazily(<Reconciliation />) },
  { path: '/organizer/settlements', element: lazily(<OrganizerSettlements />) },
  { path: '/organizer/subscriptions', element: lazily(<Subscribe />) },
  { path: '/organizer/bank-details', element: lazily(<BankDetails />) },
  { path: '/organizer/documents', element: lazily(<OpsDocuments />) },
  { path: '/organizer/certifications', element: lazily(<Certifications />) },
  { path: '/organizer/coupons', element: lazily(<Coupons />) },
  { path: '/organizer/discount-rules', element: lazily(<DiscountRules />) },
  { path: '/organizer/campaigns', element: lazily(<Campaigns />) },
  { path: '/organizer/banners', element: lazily(<Banners />) },
  { path: '/organizer/referrals', element: lazily(<Referrals />) },
  { path: '/organizer/review-requests', element: lazily(<ReviewRequests />) },
  { path: '/organizer/ai-studio', element: lazily(<AiStudio />) },
  { path: '/organizer/ai-marketing', element: lazily(<AiMarketing />) },
  { path: '/organizer/ai-insights', element: lazily(<AiInsights />) },
  { path: '/organizer/customers', element: lazily(<CrmCustomers />) },
  { path: '/organizer/leads', element: lazily(<Leads />) },
  { path: '/organizer/crm', element: lazily(<CRMDashboard />) },
  { path: '/organizer/team', element: lazily(<Team />) },
  { path: '/organizer/leaders', element: lazily(<Leaders />) },
  { path: '/organizer/vendors', element: lazily(<VendorManagement />) },
  { path: '/organizer/payment-verification', element: lazily(<PaymentVerificationDashboard />) },
  { path: '/organizer/settings', element: lazily(<OrganizerSettings />) },
];
