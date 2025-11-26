import React from 'react';
import LeadsList from '../components/crm/LeadsList';
import TicketsView from '../components/crm/TicketsView';
import BillingHistory from '../components/crm/BillingHistory';
import UpdatePaymentMethod from '../components/crm/UpdatePaymentMethod';
import AutoPayToggle from '../components/crm/AutoPayToggle';

/**
 * OrganizerCRM page
 * Aggregates CRM-related components for organizers: leads, tickets, billing,
 * payment update, and auto-pay toggle. This page should be mounted behind
 * the organizer/authenticated routes in the frontend router.
 */
export default function OrganizerCRM() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Organizer CRM</h1>
      <div style={{ display: 'grid', gap: 20 }}>
        <div>
          <h2>Leads</h2>
          <LeadsList />
        </div>

        <div>
          <h2>Support Tickets</h2>
          <TicketsView />
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <h2>Billing History</h2>
            <BillingHistory />
          </div>
          <div style={{ width: 360 }}>
            <h2>Payment Method</h2>
            <UpdatePaymentMethod />
            <AutoPayToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
