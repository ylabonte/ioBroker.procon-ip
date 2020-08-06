"use strict";

function CryptoHelper() {}

CryptoHelper.prototype = {
    legacyDecrypt: (value, key) => {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    },
    legacyEncrypt: (value, key) => {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }
};

CryptoHelper.prototype.decrypt = (value, key) => {
    if (!value.startsWith(`$/aes-192-cbc:`) || !/^[0-9a-f]{48}$/.test(key)) {
        return CryptoHelper.prototype.legacyDecrypt(value, key);
    }

    const cipherParts = value.split(':');
    const cipherText = CryptoJS.enc.Hex.parse(cipherParts[2]);
    const cipherIv = CryptoJS.enc.Hex.parse(cipherParts[1]);
    const cipherKey = CryptoJS.enc.Hex.parse(key);

    // Actually decrypt the cipher text
    const decrypter = CryptoJS.algo.AES.createDecryptor(cipherKey, { iv: cipherIv });
    const plaintext = decrypter.process(cipherText);
    plaintext.concat(decrypter.finalize());

    return plaintext.toString(CryptoJS.enc.Utf8);
};

CryptoHelper.prototype.encrypt = (value, key) => {
    if (!/^[0-9a-f]{48}$/.test(key)) {
        // key length is not matching for AES-192-CBC or key is no valid hex - fallback to old encryption
        return CryptoHelper.prototype.legacyEncrypt(value, key);
    }

    const iv = String('0').repeat(16).replace(/0/g, 
        () => parseInt(String(Math.random()*100).substr(0, 2)).toString(16).padStart(2, '0')
    );
    const cipherIv = CryptoJS.enc.Hex.parse(iv);
    const cipherKey = CryptoJS.enc.Hex.parse(key);

    // Actually decrypt the cipher text
    const encryptor = CryptoJS.algo.AES.createEncryptor(cipherKey, { iv: cipherIv });
    const cipherText = encryptor.process(value).concat(encryptor.finalize());

    return `$/aes-192-cbc:${iv}:${cipherText.toString(CryptoJS.enc.Hex)}`;
};

const cryptoHelper = new CryptoHelper();
