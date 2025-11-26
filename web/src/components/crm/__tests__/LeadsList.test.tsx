import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LeadsList from '../LeadsList';

// Basic unit test to assert the New Lead button renders and opens the form
test('renders new lead button and opens form', async () => {
  render(<LeadsList />);
  const newBtn = await screen.findByText('+ New Lead');
  expect(newBtn).toBeInTheDocument();
  fireEvent.click(newBtn);
  const saveBtn = await screen.findByText('Save');
  expect(saveBtn).toBeInTheDocument();
});
