/**
 * This is a dummy test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

// const expect = require('chai').expect;
// const CryptoJS = require('crypto-js/crypto-js');
// import * as CryptoHelper from "../admin/crypto-helper";

const expect = chai.expect;

describe("Decryption [1]: Known example input", () => {
    const expected = "Hello World!";
    // Plaintext encrypted using the aes-192-cbc implementation of the 
    // js-controller. The output of the backend encryption process was:
    const cipher = '$/aes-192-cbc:8b6ddb7ca33ccd770f3bbfca48d4ff78:7e1fd9ebf2f87604dc689862db7c74fe';
    // The secret 192-bit key in hex representation is:
    const secretKey = '1234567890abcdef1234567890abcdef1234567890abcdef';

    it(`should return '${expected}'`, () => {
        const result = cryptoHelper.decrypt(cipher, secretKey);
        expect(result).to.equal(expected);
    });
});

const encryption1_input = "";
let encryption1_result = null;
const encryption1_key = '1234567890abcdef1234567890abcdef1234567890abcdef';
describe("Encryption [1]: Empty input string", () => {
    const input = '';
    const expected = /^\$\/aes-192-cbc\:[0-9a-f]{32}\:[0-9a-f]+$/;

    it(`should return a string like '$/aes-192-cbc:[32 hex chars]:[further hex chars]'`, () => {
        encryption1_result = cryptoHelper.encrypt(input, encryption1_key);
        expect(encryption1_result).to.match(expected);
    });
});

describe("Decryption [2]: Output of Encryption [1]", () => {
    it(`should return '${encryption1_input}' (empty string)`, () => {
        const result = cryptoHelper.decrypt(encryption1_result, encryption1_key);
        expect(result).to.equal(encryption1_input);
    });
});

const encryption2_input = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
let encryption2_result = null;
const encryption2_key = '1234567890abcdef1234567890abcdef1234567890abcdef';
describe("Encryption [2]: Long input string", () => {
    const expected = /^\$\/aes-192-cbc\:[0-9a-f]{32}\:[0-9a-f]+$/;

    it(`should return a string like '$/aes-192-cbc:[32 hex chars]:[further hex chars]'`, () => {
        encryption2_result = cryptoHelper.encrypt(encryption2_input, encryption2_key);
        expect(encryption2_result).to.match(expected);
    });
});

describe("Decryption [3]: Output of Encryption [2]", () => {
    it(`should return the input of Encryption [2]`, () => {
        const result = cryptoHelper.decrypt(encryption2_result, encryption2_key);
        expect(result).to.equal(encryption2_input);
    });
});

// ... more test suites => describe
