describe('AI Chat Widget', () => {
    beforeEach(() => {
        // Mock Auth
        cy.intercept('GET', '**/api/auth/me', {
            statusCode: 200,
            body: {
                id: 'user123',
                name: 'Test Traveler',
                email: 'test@example.com',
                role: 'traveler'
            }
        }).as('getMe');

        // Mock Socket.io (if possible, or just ignore connection errors)
        // Since we can't easily mock socket.io in Cypress without a plugin, 
        // we rely on the component's fallback to HTTP if socket fails, 
        // OR we just test the interactions that don't strictly require socket if the component handles offline gracefully.
        // The component tries socket then falls back to /api/ai/chat. We should mock that.

        cy.intercept('POST', '**/api/ai/chat', {
            statusCode: 200,
            body: {
                message: "This is a mocked AI response.",
                confidence: 'high'
            }
        }).as('aiChat');

        // Mock Analytics
        cy.intercept('GET', '**/api/analytics/dashboard', {
            statusCode: 200,
            body: {
                overview: {
                    tripsJoined: 5,
                    upcomingTrips: 2,
                    wishlistCount: 10
                }
            }
        }).as('getAnalytics');

        // Mock Human Agent Request
        cy.intercept('POST', '**/api/support/human-agent/request', {
            statusCode: 200,
            body: {
                success: true,
                ticket: {
                    ticketId: 'TKT-999'
                }
            }
        }).as('requestAgent');

        // Mock Agents Available
        cy.intercept('GET', '**/api/support/agents/available', {
            body: { agents: [] }
        });

        cy.visit('/');
        // Check if app loaded at least basic UI
        cy.get('body').should('exist');
    });

    it('should open the chat widget', () => {
        cy.get('.chat-widget-toggle').click();
        cy.get('.chat-widget').should('be.visible');
        cy.contains('TrekTribe Assistant').should('be.visible');
    });

    it('should provide specific local greeting for "hello"', () => {
        cy.get('.chat-widget-toggle').click();
        cy.get('.chat-input').type('hello{enter}');

        // Should NOT call API for local greeting
        // We can't strictly assert "not called" easily without waiting, but we can check the response text comes immediately.
        // The local greeting contains "Hello Test Traveler" or "Hi!"
        cy.contains('.message.assistant', 'Hello Test Traveler', { timeout: 1000 }).should('exist');
        // OR matches one of the random greetings
        // Since it's random, we might need to check for one of the options or just "Hello" / "Hi"
        cy.get('.message.assistant').last().invoke('text').should('match', /Hello|Hi|Hey/);
    });

    it('should format analytics responses with bullet points', () => {
        cy.get('.chat-widget-toggle').click();
        // Click "My Analytics" button
        cy.contains('button', '📊 My Analytics').click();

        cy.wait('@getAnalytics');

        // Check for formatted text in the latest message
        cy.get('.message.assistant').last().within(() => {
            cy.get('.message-content').should('contain', '🎒 **Trips Joined:** 5');
            cy.get('.message-content').should('contain', '🔜 **Upcoming Adventures:** 2');
            // valid markdown check? The component renders text with style white-space: pre-wrap.
            // We verify the text content contains the key phrases.
        });
    });

    it('should create a ticket when requesting human agent', () => {
        cy.get('.chat-widget-toggle').click();
        cy.contains('button', 'Talk to a Human Agent').click();

        cy.wait('@requestAgent');

        cy.get('.message.assistant').last().within(() => {
            cy.get('.message-content').should('contain', 'Human agent support ticket created');
            cy.get('.message-content').should('contain', 'ID: TKT-999');
        });
    });
});
