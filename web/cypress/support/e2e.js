// Import commands
import './commands'

// Prevent Cypress from failing on uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent failing the test
  return false
})

// Before each test, clear local storage and cookies
beforeEach(() => {
  cy.clearLocalStorage()
  cy.clearCookies()
})
