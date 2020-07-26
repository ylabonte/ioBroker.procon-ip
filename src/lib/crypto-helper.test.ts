/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

import {expect} from "chai";
import {CryptoHelper} from "./crypto-helper";

describe("CryptoHelper => decrypt example input", () => {
    const expected = "Hello World!";
    // Plaintext encrypted using the aes-192-cbc implementation of the 
    // js-controller. The output of the backend encryption process was:
    const cipher = '$/aes-192-cbc:8b6ddb7ca33ccd770f3bbfca48d4ff78:7e1fd9ebf2f87604dc689862db7c74fe';
    // The secret 192-bit key in hex representation is:
    const secretKey = '1234567890abcdef1234567890abcdef1234567890abcdef';

    it(`should return '${expected}'`, () => {
        const result = CryptoHelper.decrypt(cipher, secretKey);
        expect(result).to.equal(expected);
    });
});

// ... more test suites => describe
