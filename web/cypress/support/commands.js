/// <reference types="cypress" />

// Custom commands for authentication
Cypress.Commands.add('login', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: { email, password }
  }).then((response) => {
    expect(response.status).to.eq(200)
    const { token, user } = response.body
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    cy.wrap(token).as('authToken')
    cy.wrap(user).as('currentUser')
  })
})

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@trektribe.com', 'Admin@123')
})

Cypress.Commands.add('loginAsOrganizer', () => {
  cy.login('organizer.premium@trektribe.com', 'Organizer@123')
})

Cypress.Commands.add('loginAsTraveler', () => {
  cy.login('traveler@trektribe.com', 'Traveler@123')
})

Cypress.Commands.add('logout', () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  cy.visit('/')
})

// Custom command for API requests with auth
Cypress.Commands.add('apiRequest', (method, url, body = null, auth = true) => {
  const options = {
    method,
    url: `${Cypress.env('apiUrl')}${url}`,
    failOnStatusCode: false
  }
  
  if (auth) {
    const token = localStorage.getItem('token')
    options.headers = { Authorization: `Bearer ${token}` }
  }
  
  if (body) {
    options.body = body
  }
  
  return cy.request(options)
})

// Custom command to wait for AI response
Cypress.Commands.add('waitForAIResponse', (timeout = 10000) => {
  cy.get('[data-cy=ai-response]', { timeout }).should('exist')
})

// Custom command to check if element contains text
Cypress.Commands.add('containsText', { prevSubject: true }, (subject, text) => {
  cy.wrap(subject).should('contain.text', text)
})
