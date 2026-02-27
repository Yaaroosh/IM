import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const toBase64 = util.encodeBase64;
const fromBase64 = util.decodeBase64;

// Generate Key
export function generateKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: toBase64(keyPair.publicKey),
        secretKey: toBase64(keyPair.secretKey)
    };
}

// Sign the SPK with the IK
export function signPreKey(spkPublicKeyBase64, ikSecretKeyBase64) {
    const spkPubKeyUint8 = fromBase64(spkPublicKeyBase64);
    const ikSecretUint8 = fromBase64(ikSecretKeyBase64);
    const signingKeyPair = nacl.sign.keyPair.fromSeed(ikSecretUint8);
    const signatureUint8 = nacl.sign.detached(spkPubKeyUint8, signingKeyPair.secretKey);
    return toBase64(signatureUint8);
}

// Generate a batch of One-Time PreKeys (OPKs)
export function generateOneTimePreKeys(count) {
    const opks = [];
    for (let i = 0; i < count; i++) {
        const keyPair = nacl.box.keyPair();
        opks.push({
            key_id: i,
            publicKey: toBase64(keyPair.publicKey),
            secretKey: toBase64(keyPair.secretKey)
        });
    }
    return opks;
}

// Perform Diffie-Hellman to get a shared secret
export function computeDH(myPrivateKeyBase64, theirPublicKeyBase64){
    const myPriv = util.decodeBase64(myPrivateKeyBase64);
    const theirPub = util.decodeBase64(theirPublicKeyBase64);
    const sharedSecret = nacl.scalarMult(myPriv, theirPub);
    return util.encodeBase64(sharedSecret);
}

// Encrypt message using SecretBox (symmetric)
export function encryptMessage(plaintext, sharedSecretBase64) {

    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageUint8 = util.decodeUTF8(plaintext);
    const keyUint8 = util.decodeBase64(sharedSecretBase64);
    const ciphertext = nacl.secretbox(messageUint8, nonce, keyUint8);

    return {
        nonce: toBase64(nonce),
        ciphertext: toBase64(ciphertext)
    };
}

// Decrypt message and verify authenticity
export function decryptMessage(ciphertextBase64, nonceBase64, sharedSecretBase64) {
    const ciphertext = util.decodeBase64(ciphertextBase64);
    const nonce = util.decodeBase64(nonceBase64);
    const keyUint8 = util.decodeBase64(sharedSecretBase64);

    const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, keyUint8);
    
    if (!decryptedBytes) {
        throw new Error("Decryption failed! Message manipulated or wrong key.");
    }
    
    return util.encodeUTF8(decryptedBytes);
}


// X3DH: Derive Initial Chain Key using SHA-512
export function deriveInitialChainKey(dh1Base64, dh2Base64, dh3Base64, dh4Base64 = "") {
    const dh1 = fromBase64(dh1Base64);
    const dh2 = fromBase64(dh2Base64);
    const dh3 = fromBase64(dh3Base64);
    const dh4 = dh4Base64 ? fromBase64(dh4Base64) : new Uint8Array(0);

    const totalLength = dh1.length + dh2.length + dh3.length + dh4.length;
    const combined = new Uint8Array(totalLength);
    
    combined.set(dh1, 0);
    combined.set(dh2, dh1.length);
    combined.set(dh3, dh1.length + dh2.length);
    if (dh4.length > 0) {
        combined.set(dh4, dh1.length + dh2.length + dh3.length);
    }

    const hashResult = nacl.hash(combined);

    const chainKeyUint8 = hashResult.slice(0, 32); 
    return toBase64(chainKeyUint8);
}


// Symmetric Ratchet: Hash the current chain key to get a message key and next chain key
export function deriveNextKeys(currentChainKeyBase64) {
    const currentChainKeyUint8 = util.decodeBase64(currentChainKeyBase64);
    
    const constantForMessageKey = new Uint8Array([1]);
    const constantForNextChainKey = new Uint8Array([2])
    
    const messageKeyUint8 = nacl.auth(constantForMessageKey, currentChainKeyUint8); //nacl.auth is the implementation of HMAC
    const nextChainKeyUint8 = nacl.auth(constantForNextChainKey, currentChainKeyUint8);
    
    return {
        messageKey: util.encodeBase64(messageKeyUint8),
        nextChainKey: util.encodeBase64(nextChainKeyUint8)
    };
}