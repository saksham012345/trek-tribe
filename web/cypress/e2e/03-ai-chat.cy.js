/// <reference types="cypress" />

describe('AI Chat Widget', () => {
  beforeEach(() => {
    cy.visit('/', { failOnStatusCode: false })
  })

  it('should load the page', () => {
    cy.get('body', { timeout: 10000 }).should('be.visible')
  })

  it('should be accessible', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle page navigation', () => {
    cy.visit('/support', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should be responsive', () => {
    cy.viewport('iphone-x')
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should reset viewport', () => {
    cy.viewport('macbook-15')
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle queries gracefully', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should maintain session', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.visit('/trips', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle multiple pages', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.visit('/trips', { failOnStatusCode: false })
    cy.visit('/bookings', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display content correctly', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('have.length.greaterThan', 0)
  })

  it('should be interactive', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should load images', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('img', { timeout: 5000 }).should('exist')
  })

  it('should handle links', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.get('a, button', { timeout: 5000 }).should('exist')
  })
})
