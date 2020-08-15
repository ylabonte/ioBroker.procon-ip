/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

import {expect} from "chai";
import {CryptoHelper} from "./crypto-helper";

describe("Decryption [1]: Known example input", () => {
    const expected = "Hello World!";
    const cipher = "$/aes-192-cbc:8b6ddb7ca33ccd770f3bbfca48d4ff78:7e1fd9ebf2f87604dc689862db7c74fe";
    const secretKey = "1234567890abcdef1234567890abcdef1234567890abcdef";

    it(`should return '${expected}'`, () => {
        const result = CryptoHelper.decrypt(cipher, secretKey);
        expect(result).to.equal(expected);
    });
});

describe("Decryption [2]: Output of front-end Encryption [1]", () => {
    const expected = "";
    const cipher = "$/aes-192-cbc:0b13495812312f1c4346234d193b442e:7ce92eb4b431ad25da4188257bd87a03";
    const secretKey = "1234567890abcdef1234567890abcdef1234567890abcdef";

    it(`should return '${expected}' (empty string)`, () => {
        const result = CryptoHelper.decrypt(cipher, secretKey);
        expect(result).to.equal(expected);
    });
});

describe("Decryption [3]: Output of front-end Encryption [2]", () => {
    const expected = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
    const cipher = "$/aes-192-cbc:6248010f136161413f5a005c273d3614:ed6867316342f1dcd8c8d15e4e9f6052e4d6c3c90c9f6825753ab4c569eb638c8b3519dfda02c9068c15e5bc4d125de8b3250d1754b0abc81c42c7d3b094ad6fc4659ecddb763fa819329a250135dab870b7899a03e318a270397ee455a772bf2c9c50125bbe822ad7def8d887c43432d00404622219a6d1deaf3159052cb80bb3d31b09706cd7feec4be3a39784aaebcae09323e50469d18824601151d507c0d7fb84821a0dfcc877eb4a5945cfdf9130e71288fbfa757c811371333a080726a6d4451e663da8b9bf3eab500f48d6c65a65983ab3e280eff0ffef987672159c8ad7e72e3a9037dae1fd6391979f7e0da954dcc89a3570c0430c3da8bbdaa1b174806f18b8f410c04567dd717c9b2ac8c04b7c5e26fba66cfed33f671f0970279e4671ff384aa31fb26d9727f03127bfaf8137ea72216e8ea5495cf13fd61e632d903bb4d24a7a5d935e8eefc9dd99bd188ec63dc0a178c03d5ac788346f439f709f30d074d59e974f29c0ebbc4b7c3a94a085d5de28674a515cc4c615a311010c9ab95b8f40eaa81a95a0fd8f4bdfaa5bf158201da78089181a22298f70bd3d001600af693cb57e0435ade100b24590feb0b2c6ba255403666c97689868e255";
    const secretKey = "1234567890abcdef1234567890abcdef1234567890abcdef";

    it(`should return a predefined long string`, () => {
        const result = CryptoHelper.decrypt(cipher, secretKey);
        expect(result).to.equal(expected);
    });
});

const encryption1_input = "";
let encryption1_result: string;
const encryption1_key = "1234567890abcdef1234567890abcdef1234567890abcdef";
describe("Encryption [1]: Empty input string", () => {
    const input = "";
    const expected = /^\$\/aes-192-cbc\:[0-9a-f]{32}\:[0-9a-f]+$/;

    it(`should return a string like '$/aes-192-cbc:[32 hex chars]:[further hex chars]'`, () => {
        encryption1_result = CryptoHelper.encrypt(input, encryption1_key);
        expect(encryption1_result).to.match(expected);
    });
});

describe("Decryption [4]: Output of Encryption [1]", () => {
    it(`should return '${encryption1_input}' (empty string)`, () => {
        const result = CryptoHelper.decrypt(encryption1_result, encryption1_key);
        expect(result).to.equal(encryption1_input);
    });
});

const encryption2_input = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.".repeat(1000);
let encryption2_result: string;
const encryption2_key = "1234567890abcdef1234567890abcdef1234567890abcdef";
describe("Encryption [2]: Long input string", () => {
    const expected = /^\$\/aes-192-cbc\:[0-9a-f]{32}\:[0-9a-f]+$/;

    it(`should return a string like '$/aes-192-cbc:[32 hex chars]:[further hex chars]'`, () => {
        encryption2_result = CryptoHelper.encrypt(encryption2_input, encryption2_key);
        expect(encryption2_result).to.match(expected);
    });
});

describe("Decryption [5]: Output of Encryption [2]", () => {
    it(`should return the input of Encryption [2]`, () => {
        const result = CryptoHelper.decrypt(encryption2_result, encryption2_key);
        expect(result).to.equal(encryption2_input);
    });
});

// ... more test suites => describe
