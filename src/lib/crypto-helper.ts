import * as crypto from "crypto";

/**
 * 
 */
export class CryptoHelper {

    private static log = class {
        public static debug(message: string): void {
            console.log(`DEBUG: ${message}`);
        }
        public static info(message: string): void {
            console.log(`INFO: ${message}`);
        }
        public static warn(message: string): void {
            console.log(`WARNING: ${message}`);
        }
        public static error(message: string): void {
            console.log(`ERROR: ${message}`);
        }
    }
    
    private static legacyDecrypt(value: string, key: string): string {
        let result = "";
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }

        return result;
    }

    /**
     * Decrypt strings using the same techniques as the js-controller >= 3.2.
     * 
     * It is just named _custom_ to avoid any potential for naming conflicts with the upcoming
     * native encryption/decryption methods of the `adapter` object, that will be introduced
     * with js-controller >= 3.1. 
     * 
     * Read more: https://github.com/ioBroker/ioBroker.js-controller/pull/887#issuecomment-633285095
     * 
     * @param value cipher text
     * @param key secret
     */
    public static decrypt(value: string, key: string): string {
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
                decipher.final()]
            ).toString();
        } catch (e) {
            this.log.warn("Error on decrypting a setting!");
            this.log.info("Please visit settings and re-enter your connection parameters.");
            this.log.debug(`Exact error was: ${e}`);
        }

        return "";
    }
}