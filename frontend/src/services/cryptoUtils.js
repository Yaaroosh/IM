import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import { sha512 } from 'js-sha512';

const toBase64 = util.encodeBase64;
const fromBase64 = util.decodeBase64;

// Generate Key pair using Curve25519
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

// Derives a public key from a given private key.
// Used during the Double Ratchet process to generate ephemeral public keys.
export function getPublicKey(privateKeyBase64) {
    const priv = fromBase64(privateKeyBase64);
    const pub = nacl.scalarMult.base(priv); 
    return toBase64(pub);
}

// Performs an Elliptic-Curve Diffie-Hellman (ECDH) to get a shared secret
export function computeDH(myPrivateKeyBase64, theirPublicKeyBase64) {
    try {
        if (!myPrivateKeyBase64 || !theirPublicKeyBase64) {
            throw new Error(`Missing keys: myPriv=${!!myPrivateKeyBase64}, theirPub=${!!theirPublicKeyBase64}`);
        }

        const myPriv = util.decodeBase64(myPrivateKeyBase64);
        const theirPub = util.decodeBase64(theirPublicKeyBase64);

        if (myPriv.length !== 32 || theirPub.length !== 32) {
             throw new Error("Invalid key length after decoding");
        }

        const dh_output = nacl.scalarMult(myPriv, theirPub);
        
        return util.encodeBase64(dh_output);
        
    } catch (error) {
        console.error("Critical error in computeDH:", error.message);
        throw error; 
    }
}

// Root Key KDF: The "Asymmetric Ratchet"
// Updates the Root Key and derives a new Chain Key using a DH shared secret
export function kdfRK(currentRootKeyBase64, dhResultBase64) {
    const rk = fromBase64(currentRootKeyBase64);
    const dh = fromBase64(dhResultBase64);

    const hmac = sha512.hmac.create(rk);
    hmac.update(dh);
    const result = new Uint8Array(hmac.array());

    return {
        nextRootKey: toBase64(result.slice(0, 32)),
        nextChainKey: toBase64(result.slice(32, 64))
    };
}

// Symmetric Ratchet: Hash the current chain key to get a message key and next chain key
export function kdfCK(currentChainKeyBase64) {
    const currentChainKeyUint8 = fromBase64(currentChainKeyBase64);

    const hmac = (key, data) => {
        const hash = sha512.hmac.create(key);
        hash.update(data);
        return new Uint8Array(hash.array());
    };

    const messageKeyUint8 = hmac(currentChainKeyUint8, new Uint8Array([1])).slice(0, 32);
    const nextChainKeyUint8 = hmac(currentChainKeyUint8, new Uint8Array([2])).slice(0, 32);

     return {
        messageKey: util.encodeBase64(messageKeyUint8),
        nextChainKey: util.encodeBase64(nextChainKeyUint8)
    };
}



// Encrypt message using SecretBox (symmetric)
export function encryptMessage(plaintext, messageKeyBase64) {

    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageUint8 = util.decodeUTF8(plaintext);
    const keyUint8 = util.decodeBase64(messageKeyBase64);
    const ciphertext = nacl.secretbox(messageUint8, nonce, keyUint8);

    return {
        nonce: toBase64(nonce),
        ciphertext: toBase64(ciphertext)
    };
}

// Decrypt message and verify authenticity
export function decryptMessage(ciphertextBase64, nonceBase64, messageKeyBase64) {
    const ciphertext = fromBase64(ciphertextBase64);
    const nonce = fromBase64(nonceBase64);
    const keyUint8 = fromBase64(messageKeyBase64);

    const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, keyUint8);
    
    if (!decryptedBytes) {
        throw new Error("Decryption failed! Message manipulated or wrong key.");
    }
    
    return util.encodeUTF8(decryptedBytes);
}


// X3DH: Derive Initial Root Key using HMAC-SHA512
export function deriveInitialRootKey(dh1Base64, dh2Base64, dh3Base64, dh4Base64 = "") {
    const dh1 = fromBase64(dh1Base64);
    const dh2 = fromBase64(dh2Base64);
    const dh3 = fromBase64(dh3Base64);
    const dh4 = dh4Base64 ? fromBase64(dh4Base64) : new Uint8Array(0);

    const totalLength = dh1.length + dh2.length + dh3.length + dh4.length;
    const sharedSecret = new Uint8Array(totalLength);
    
    sharedSecret.set(dh1, 0);
    sharedSecret.set(dh2, dh1.length);
    sharedSecret.set(dh3, dh1.length + dh2.length);
    if (dh4.length > 0) {
        sharedSecret.set(dh4, dh1.length + dh2.length + dh3.length);
    }

    const salt = new Uint8Array(64).fill(0);

    const hmac = sha512.hmac.create(salt);
    hmac.update(sharedSecret);
    const hashResult = new Uint8Array(hmac.array());

    const RootKey = hashResult.slice(0, 32); 
    return toBase64(RootKey);
}
