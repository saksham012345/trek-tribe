/**
 * Bug Condition Exploration Test for Profile URL Display
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * This test is designed to FAIL on unfixed code to demonstrate the bug exists.
 * The bug: Profile URLs use `/profile/` prefix with ObjectId instead of `/u/` prefix with username.
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * Expected counterexamples:
 * - URLs using `/profile/` prefix instead of `/u/`
 * - URLs using ObjectId instead of username
 * - Registration hint showing incorrect format
 * - Profile share generating wrong URL format
 */

import * as fc from 'fast-check';

// Mock user profile data structure
interface UserProfile {
  _id: string;
  username?: string;
  uniqueUrl?: string;
  name: string;
}

// Helper to check if a string is a MongoDB ObjectId
const isObjectId = (str: string): boolean => {
  return /^[0-9a-f]{24}$/i.test(str);
};

// Helper to extract path prefix from URL
const getPathPrefix = (url: string): string => {
  const match = url.match(/\/(profile|u)\//);
  return match ? `/${match[1]}/` : '';
};

// Helper to extract identifier from URL
const getIdentifier = (url: string): string => {
  const match = url.match(/\/(profile|u)\/([^/?#]+)/);
  return match ? match[2] : '';
};

describe('Property 1: Fault Condition - Profile URLs Use Username Format', () => {
  
  describe('Bug Condition Exploration - Profile URL Generation', () => {
    
    it('EXPLORATION TEST: Registration URL hint should show /u/ prefix with username', () => {
      // This test checks the registration form URL hint
      // Current bug: Shows "trektribe.com/profile/{username}"
      // Expected: Should show "trektribe.com/u/{username}"
      
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (userData) => {
            // Simulate the registration form URL hint generation
            // This is what Register.tsx line 368 currently does
            const currentHint = `trektribe.com/profile/${userData.username}`;
            
            // Expected behavior: Should use /u/ prefix
            const expectedHint = `trektribe.com/u/${userData.username}`;
            
            // This assertion will FAIL on unfixed code, confirming the bug
            expect(currentHint).toBe(expectedHint);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('EXPLORATION TEST: Profile share should generate /u/ prefix with username', () => {
      // This test checks profile sharing functionality
      // Current bug: Uses "/profile/" prefix and may use ObjectId
      // Expected: Should use "/u/" prefix with username fallback
      
      fc.assert(
        fc.property(
          fc.record({
            _id: fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            username: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            uniqueUrl: fc.option(fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (profile) => {
            // Simulate what SearchPage.tsx lines 88-89 currently do
            const currentUrl = profile.uniqueUrl 
              ? `${window.location.origin}/profile/${profile.uniqueUrl}`
              : `${window.location.origin}/profile/${profile._id}`;
            
            // Expected behavior: Should use /u/ prefix with username fallback
            const identifier = profile.username || profile.uniqueUrl || profile._id;
            const expectedUrl = `${window.location.origin}/u/${identifier}`;
            
            // Extract components for detailed assertion
            const currentPrefix = getPathPrefix(currentUrl);
            const currentIdentifier = getIdentifier(currentUrl);
            
            // These assertions will FAIL on unfixed code
            expect(currentPrefix).toBe('/u/');
            
            // Should prefer username over uniqueUrl over _id
            if (profile.username) {
              expect(currentIdentifier).toBe(profile.username);
            } else if (profile.uniqueUrl) {
              expect(currentIdentifier).toBe(profile.uniqueUrl);
            } else {
              expect(currentIdentifier).toBe(profile._id);
            }
            
            // Should not use ObjectId when username is available
            if (profile.username) {
              expect(isObjectId(currentIdentifier)).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('EXPLORATION TEST: Search navigation should use /u/ prefix with username', () => {
      // This test checks search result navigation
      // Current bug: SearchPage.tsx line 82 uses `/profile/${profile._id}`
      // Expected: Should use `/u/` with username fallback
      
      fc.assert(
        fc.property(
          fc.record({
            _id: fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            username: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            uniqueUrl: fc.option(fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (profile) => {
            // Simulate what SearchPage.tsx line 82 currently does
            const currentNavigationPath = `/profile/${profile._id}`;
            
            // Expected behavior: Should use username with fallback
            const identifier = profile.username || profile.uniqueUrl || profile._id;
            const expectedNavigationPath = `/u/${identifier}`;
            
            // Extract components
            const currentPrefix = getPathPrefix(currentNavigationPath);
            const currentIdentifier = getIdentifier(currentNavigationPath);
            
            // These assertions will FAIL on unfixed code
            expect(currentPrefix).toBe('/u/');
            expect(currentIdentifier).not.toBe(profile._id);
            
            // Should use username if available
            if (profile.username) {
              expect(currentIdentifier).toBe(profile.username);
              expect(isObjectId(currentIdentifier)).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('EXPLORATION TEST: Profile edit preview should show /u/ prefix with username', () => {
      // This test checks profile edit form URL preview
      // Current bug: EnhancedProfilePage.tsx line 514 shows "/profile/{username}"
      // Expected: Should show "/u/{username}"
      
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (editForm) => {
            // Simulate what EnhancedProfilePage.tsx line 514 currently does
            const currentPreview = `${window.location.origin}/profile/${editForm.username || 'username'}`;
            
            // Expected behavior: Should use /u/ prefix
            const expectedPreview = `${window.location.origin}/u/${editForm.username || 'username'}`;
            
            // Extract prefix
            const currentPrefix = getPathPrefix(currentPreview);
            
            // This assertion will FAIL on unfixed code
            expect(currentPrefix).toBe('/u/');
            expect(currentPreview).toBe(expectedPreview);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('EXPLORATION TEST: Profile URLs should never use ObjectId when username exists', () => {
      // This test verifies that when a user has a username, it should be used instead of ObjectId
      // Current bug: Code uses ObjectId even when username is available
      
      fc.assert(
        fc.property(
          fc.record({
            _id: fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (profile) => {
            // When username exists, URL should use username, not ObjectId
            // Simulate current behavior from various components
            const currentUrls = [
              `/profile/${profile._id}`, // SearchPage.tsx line 82
              `${window.location.origin}/profile/${profile._id}`, // SearchPage.tsx line 89
              `/profile/${profile.username}` // EnhancedProfileCard.tsx (but wrong prefix)
            ];
            
            // Expected: All URLs should use /u/ prefix and username
            const expectedPath = `/u/${profile.username}`;
            
            currentUrls.forEach(url => {
              const prefix = getPathPrefix(url);
              const identifier = getIdentifier(url);
              
              // These assertions will FAIL on unfixed code
              expect(prefix).toBe('/u/');
              
              // Should not use ObjectId when username exists
              if (identifier === profile._id) {
                expect(isObjectId(identifier)).toBe(false);
              }
            });
          }
        ),
        { numRuns: 8 }
      );
    });

    it('EXPLORATION TEST: Username fallback order should be username → uniqueUrl → _id', () => {
      // This test verifies the correct fallback order for profile identifiers
      // Current bug: Code doesn't follow consistent fallback order
      
      fc.assert(
        fc.property(
          fc.record({
            _id: fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            username: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            uniqueUrl: fc.option(fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-z0-9-]+$/.test(s)), { nil: undefined }),
            name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          (profile) => {
            // Expected fallback order
            const expectedIdentifier = profile.username || profile.uniqueUrl || profile._id;
            
            // Simulate what EnhancedProfileCard.tsx line 123 does (correct fallback but wrong prefix)
            const currentIdentifier = profile.username || profile.uniqueUrl || profile._id;
            const currentUrl = `${window.location.origin}/profile/${currentIdentifier}`;
            
            // Expected URL with correct prefix
            const expectedUrl = `${window.location.origin}/u/${expectedIdentifier}`;
            
            // Extract prefix
            const prefix = getPathPrefix(currentUrl);
            
            // This assertion will FAIL on unfixed code (wrong prefix)
            expect(prefix).toBe('/u/');
            expect(currentUrl).toBe(expectedUrl);
            
            // Verify fallback order is correct
            if (profile.username) {
              expect(currentIdentifier).toBe(profile.username);
            } else if (profile.uniqueUrl) {
              expect(currentIdentifier).toBe(profile.uniqueUrl);
            } else {
              expect(currentIdentifier).toBe(profile._id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
