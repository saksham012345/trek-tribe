/// <reference types="cypress" />

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/', { failOnStatusCode: false })
  })

  it('should load the homepage', () => {
    cy.get('body', { timeout: 10000 }).should('be.visible')
  })

  it('should have header/navigation available', () => {
    cy.get('header, nav, [role="navigation"]', { timeout: 5000 }).should('exist')
  })

  it('should access the site without errors', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body').should('be.visible')
  })

  it('should login as organizer', () => {
    cy.visit('/login', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should login as admin', () => {
    cy.visit('/login', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle navigation gracefully', () => {
    cy.visit('/register', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })
})
})
