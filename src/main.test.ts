/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

import { expect } from 'chai';
// import { ProconIp } from './main';

describe('Controller URL pre-check', () => {
    it(`URL('') should throw TypeError [ERR_INVALID_URL]`, () => {
        expect(() => new URL('')).to.throw('Invalid URL');
    });
});

// ... more test suites => describe
