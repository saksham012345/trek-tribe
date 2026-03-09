/**
 * Fast-check setup verification test
 * This test verifies that fast-check is properly configured with Jest
 */

import * as fc from 'fast-check';

describe('Fast-check Setup', () => {
  it('should import fast-check successfully', () => {
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
    expect(fc.property).toBeDefined();
  });

  it('should run a simple property test', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n;
      })
    );
  });

  it('should run a string property test', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return s.length >= 0;
      })
    );
  });

  it('should handle array property tests', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        return arr.length === arr.filter(x => typeof x === 'number').length;
      })
    );
  });
});
