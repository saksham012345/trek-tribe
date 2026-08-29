/**
 * Sprint 8 gate: trip_leader scoping enforced server-side.
 *
 * The dangerous case is not "a leader sees the wrong trip". It is a leader with
 * NO assignments seeing EVERY trip, because an empty array is falsy-adjacent
 * and `if (!scope)` reads as "no restriction". That mistake fails open, which is
 * the direction that matters, and it is invisible in the UI - the screen shows
 * a list and nobody thinks to ask why it is long.
 *
 * applyTripScope exists so no caller has to make that judgement, and these
 * tests pin the distinction between null and [].
 */

import { applyTripScope, applyTripScopeToField } from '../modules/team/team.service';

describe('trip scope', () => {
  describe('null means unrestricted', () => {
    it('produces an empty fragment, which widens nothing when spread', () => {
      expect(applyTripScope(null)).toEqual({});
    });

    it('leaves a where clause exactly as it was', () => {
      const where = { organizerId: 'org-1', ...applyTripScope(null) };
      expect(where).toEqual({ organizerId: 'org-1' });
    });
  });

  describe('an empty list means nothing, never everything', () => {
    // This is the test the gate is really about.
    it('produces an IN () filter rather than an empty fragment', () => {
      expect(applyTripScope([])).toEqual({ id: { in: [] } });
    });

    it('is not equal to the unrestricted fragment', () => {
      expect(applyTripScope([])).not.toEqual(applyTripScope(null));
    });

    it('survives being spread into a where clause', () => {
      const where = { organizerId: 'org-1', ...applyTripScope([]) };
      expect(where).toEqual({ organizerId: 'org-1', id: { in: [] } });
    });

    it('is truthy as an object, so a falsy check on the fragment cannot skip it', () => {
      // Guards against a caller writing `if (frag)` and getting it wrong.
      expect(Boolean(applyTripScope([]))).toBe(true);
    });
  });

  describe('a populated list restricts to exactly that list', () => {
    it('filters to the assigned trips', () => {
      expect(applyTripScope(['t1', 't2'])).toEqual({ id: { in: ['t1', 't2'] } });
    });

    it('does not mutate the scope it was given', () => {
      const scope = ['t1'];
      applyTripScope(scope);
      expect(scope).toEqual(['t1']);
    });
  });

  describe('applyTripScopeToField, for tables that reference a trip', () => {
    it('defaults to tripId', () => {
      expect(applyTripScopeToField(['t1'])).toEqual({ tripId: { in: ['t1'] } });
    });

    it('honours a named field', () => {
      expect(applyTripScopeToField(['t1'], 'trip_id')).toEqual({ trip_id: { in: ['t1'] } });
    });

    it('keeps the same null-versus-empty distinction', () => {
      expect(applyTripScopeToField(null)).toEqual({});
      expect(applyTripScopeToField([])).toEqual({ tripId: { in: [] } });
    });
  });
});
