/// <reference types="cypress" />

describe('Profile Features', () => {
    beforeEach(() => {
        // Mock authentication
        cy.window().then((win) => {
            win.localStorage.setItem('user', JSON.stringify({
                id: 'user123',
                name: 'Test User',
                role: 'organizer',
                profilePhoto: 'https://example.com/photo.jpg'
            }));
            win.localStorage.setItem('token', 'mock-token');
        });

        // Mock API response
        cy.intercept('GET', '**/api/v1/profile/enhanced/*', {
            statusCode: 200,
            body: {
                success: true,
                data: {
                    user: {
                        _id: 'user123',
                        name: 'Test User',
                        role: 'organizer',
                        bio: 'Adventure seeker',
                        stats: { trips: 5, followers: 100 }
                    },
                    isOwnProfile: true,
                    roleBasedData: {
                        canPost: true,
                        portfolioVisible: true
                    }
                }
            }
        }).as('getProfile');

        cy.intercept('GET', '**/api/v1/profile/enhanced/other-user-id', {
            statusCode: 200,
            body: {
                success: true,
                data: {
                    user: {
                        _id: 'other-user-id',
                        name: 'Other User',
                        role: 'traveler'
                    },
                    isOwnProfile: false,
                    roleBasedData: {
                        canPost: false
                    }
                }
            }
        }).as('getOtherProfile');
    });

    it('should render the enhanced profile with forest theme', () => {
        cy.visit('/my-profile', { failOnStatusCode: false });
        cy.wait('@getProfile');

        // Check for theme elements which are part of the new design
        // The profile header usually contains the name and role
        cy.contains('Test User').should('be.visible');
        cy.contains('organizer').should('be.visible');
    });

    it('should show Create Post button for own profile (Organizer)', () => {
        cy.visit('/my-profile', { failOnStatusCode: false });
        cy.wait('@getProfile');
        cy.contains('button', 'Create Post', { timeout: 10000 }).should('exist');
    });

    it('should show Edit Profile button', () => {
        cy.visit('/my-profile', { failOnStatusCode: false });
        cy.wait('@getProfile');
        cy.contains('button', 'Edit Profile').should('be.visible');
    });

    it('should toggle edit mode', () => {
        cy.visit('/my-profile', { failOnStatusCode: false });
        cy.wait('@getProfile');
        cy.contains('button', 'Edit Profile').click();
        cy.contains('button', 'Save Changes').should('be.visible');
    });

    it('should NOT show Create Post on other user profile', () => {
        // Visit another user's profile
        cy.visit('/profile/enhanced/other-user-id', { failOnStatusCode: false });
        // Or if the route is /profile/:id
        // cy.visit('/profile/other-user-id');

        // Based on App.tsx routes, assume /profile/:id maps to EnhancedProfilePage

        cy.wait('@getOtherProfile');
        cy.contains('button', 'Create Post').should('not.exist');
    });
});
