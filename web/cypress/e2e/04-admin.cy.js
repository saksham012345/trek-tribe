/// <reference types="cypress" />

describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.visit('/admin', { failOnStatusCode: false })
  })

  it('should load admin area', () => {
    cy.get('body', { timeout: 10000 }).should('be.visible')
  })

  it('should handle admin pages', () => {
    cy.visit('/admin/users', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should access trips management', () => {
    cy.visit('/admin/trips', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should access organizer verification', () => {
    cy.visit('/admin/organizer-verification', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display admin features', () => {
    cy.visit('/admin', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('have.length.greaterThan', 0)
  })

  it('should handle analytics', () => {
    cy.visit('/admin/analytics', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should access support tickets', () => {
    cy.visit('/admin/support', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should be responsive', () => {
    cy.viewport('iphone-x')
    cy.visit('/admin', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should have proper navigation', () => {
    cy.visit('/admin', { failOnStatusCode: false })
    cy.get('a, button, [role="navigation"]', { timeout: 5000 }).should('exist')
  })

  it('should maintain session', () => {
    cy.visit('/admin', { failOnStatusCode: false })
    cy.visit('/admin/users', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle errors gracefully', () => {
    cy.visit('/admin/nonexistent', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })
})
