import React from 'react';
import BankDetailsTab from '../../components/crm/BankDetailsTab';

/**
 * Where "Bank & KYC" in the organizer nav leads.
 *
 * There was a dedicated onboarding screen for this. It was switched off —
 * App.tsx still carries the comment, "Route onboarding disabled, using
 * simplified bank details collection instead" — and the simpler collection it
 * names lives in BankDetailsTab, inside OrganizerCRMDashboard.
 *
 * That dashboard is imported nowhere and has no route, so the replacement was
 * never reachable either. The nav link, and two more on the payouts screen,
 * pointed at the disabled route and rendered a blank page: header, white space,
 * footer, no error. Bank details could not be entered from anywhere in the app.
 *
 * The tab takes no props and loads its own data, so it stands on its own here.
 */
const BankDetails: React.FC = () => (
  <div className="p-6 max-w-4xl mx-auto">
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-gray-900">Bank &amp; KYC</h1>
      <p className="text-sm text-gray-500 mt-1">
        Where payouts are sent. Settlements cannot be released until this is complete.
      </p>
    </header>
    <BankDetailsTab />
  </div>
);

export default BankDetails;
