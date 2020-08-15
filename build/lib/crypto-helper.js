"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoHelper = void 0;
const crypto = require("crypto");
/**
 *
 */
class CryptoHelper {
    static legacyDecrypt(value, key) {
        let result = "";
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }
    static legacyEncrypt(value, key) {
        let result = "";
        for (let i = 0; i < value.length; i++) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }
    /**
     * Decrypt strings using the same techniques as the js-controller >= 3.2.
     *
     * Read more: https://github.com/ioBroker/ioBroker.js-controller/pull/887#issuecomment-633285095
     *
     * @param value cipher text
     * @param key secret
     */
    static decrypt(value, key) {
        // Fallback to legacy decryption if either value or key are not valid for the aes-192-cbc 
        // variant. See: https://github.com/ioBroker/ioBroker.js-controller/pull/887/files
        if (!value.startsWith(`$/aes-192-cbc:`) || !/^[0-9a-f]{48}$/.test(key)) {
            return CryptoHelper.legacyDecrypt(value, key);
        }
        try {
            const cipherParts = value.split(":");
            const cipherSuite = "aes-192-cbc";
            const cipherKey = Buffer.from(key, "hex");
            const cipherIv = Buffer.from(cipherParts[1], "hex");
            const cipherText = Buffer.from(cipherParts[2], "hex");
            const decipher = crypto.createDecipheriv(cipherSuite, cipherKey, cipherIv);
            return Buffer.concat([
                decipher.update(cipherText),
                decipher.final()
            ]).toString();
        }
        catch (e) {
            this.log.warn("Error on decrypting a setting!");
            this.log.info("Please visit settings and re-enter your connection parameters.");
            this.log.debug(`Exact error was: ${e}`);
        }
        return "";
    }
    /**
     * Encrypt strings using the same techniques as the js-controller >= 3.2.
     *
     * Read more: https://github.com/ioBroker/ioBroker.js-controller/pull/887#issuecomment-633285095
     *
     * @param value plain text
     * @param key secret
     */
    static encrypt(value, key) {
        // Fallback to legacy encryption if the key is not valid for the aes-192-cbc 
        // variant. See: https://github.com/ioBroker/ioBroker.js-controller/pull/887/files
        if (!/^[0-9a-f]{48}$/.test(key)) {
            return CryptoHelper.legacyEncrypt(key, value);
        }
        const cipherSuite = "aes-192-cbc";
        const cipherKey = Buffer.from(key, "hex");
        const cipherIv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(cipherSuite, cipherKey, cipherIv);
        const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
        return `$/aes-192-cbc:${cipherIv.toString("hex")}:${encrypted.toString("hex")}`;
    }
}
exports.CryptoHelper = CryptoHelper;
CryptoHelper.log = class {
    static debug(message) {
        console.log(`DEBUG: ${message}`);
    }
    static info(message) {
        console.log(`INFO: ${message}`);
    }
    static warn(message) {
        console.log(`WARNING: ${message}`);
    }
    static error(message) {
        console.log(`ERROR: ${message}`);
    }
};
