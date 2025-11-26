import React from 'react';
import { render, screen } from '@testing-library/react';
import TicketsView from '../TicketsView';

test('renders tickets view placeholder', async () => {
  render(<TicketsView />);
  const loading = await screen.findByText(/Loading tickets/i);
  expect(loading).toBeInTheDocument();
});
