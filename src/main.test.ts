/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

import {expect} from "chai";
// import { ProconIp } from "./main";

describe("module to test => function to test", () => {
    // initializing logic
    const expected = 5;

    it(`should return ${expected}`, () => {
        const result = 5;
        // assign result a value from functionToTest
        expect(result).to.equal(expected);
        // or using the should() syntax
        result.should.equal(expected);
    });
    // ... more tests => it
});

describe("Controller URL precheck", () => {
    it("URL('') should throw TypeError [ERR_INVALID_URL]", () => {
        expect(() => new URL("")).to.throw("Invalid URL");
    });
    // it("ProconIp.isValidURL() returns false for empty string", () => {
    //     expect(ProconIp.isValidURL.bind("")).to.equal(false);
    // });
});

// ... more test suites => describe
