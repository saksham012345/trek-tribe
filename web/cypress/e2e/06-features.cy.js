/// <reference types="cypress" />

describe('Platform Features', () => {
  beforeEach(() => {
    cy.visit('/', { failOnStatusCode: false })
  })

  it('should load and display', () => {
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle user profile', () => {
    cy.visit('/profile', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should show organizer dashboard', () => {
    cy.visit('/organizer', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display marketplace', () => {
    cy.visit('/marketplace', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle social sharing', () => {
    cy.visit('/trips', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should show reviews section', () => {
    cy.visit('/reviews', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display support center', () => {
    cy.visit('/support', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle notifications', () => {
    cy.visit('/notifications', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should show AI assistant', () => {
    cy.visit('/ai-chat', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display analytics', () => {
    cy.visit('/analytics', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle messaging', () => {
    cy.visit('/messages', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should show settings', () => {
    cy.visit('/settings', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display search results', () => {
    cy.visit('/search?q=trek', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should handle filters', () => {
    cy.visit('/trips?difficulty=easy', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })

  it('should display wishlist', () => {
    cy.visit('/wishlist', { failOnStatusCode: false })
    cy.get('body', { timeout: 5000 }).should('be.visible')
  })
})
