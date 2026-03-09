module.exports = {
  testEnvironment: 'jsdom',
  
  // Map ESM modules to their CommonJS versions
  moduleNameMapper: {
    '^fast-check$': '<rootDir>/node_modules/fast-check/lib/cjs/fast-check.js',
    '^pure-rand/generator/congruential32$': '<rootDir>/node_modules/pure-rand/lib/generator/congruential32.js',
    '^pure-rand/generator/mersenne$': '<rootDir>/node_modules/pure-rand/lib/generator/mersenne.js',
    '^pure-rand/generator/xorshift128plus$': '<rootDir>/node_modules/pure-rand/lib/generator/xorshift128plus.js',
    '^pure-rand/generator/xoroshiro128plus$': '<rootDir>/node_modules/pure-rand/lib/generator/xoroshiro128plus.js',
    '^pure-rand/distribution/uniformBigInt$': '<rootDir>/node_modules/pure-rand/lib/distribution/uniformBigInt.js',
    '^pure-rand/distribution/uniformInt$': '<rootDir>/node_modules/pure-rand/lib/distribution/uniformInt.js',
    '^pure-rand/types/JumpableRandomGenerator$': '<rootDir>/node_modules/pure-rand/lib/types/JumpableRandomGenerator.js',
    '^pure-rand/types/RandomGenerator$': '<rootDir>/node_modules/pure-rand/lib/types/RandomGenerator.js',
    '^pure-rand/utils/generateN$': '<rootDir>/node_modules/pure-rand/lib/utils/generateN.js',
    '^pure-rand/utils/purify$': '<rootDir>/node_modules/pure-rand/lib/utils/purify.js',
    '^pure-rand/utils/skipN$': '<rootDir>/node_modules/pure-rand/lib/utils/skipN.js',
  },
  
  // Transform ESM modules that Jest would normally ignore
  transformIgnorePatterns: [
    'node_modules/(?!(fast-check|pure-rand)/)'
  ],
};
