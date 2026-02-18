import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const toBase64 = util.encodeBase64;
const fromBase64 = util.decodeBase64;

export function generateIdentityKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: toBase64(keyPair.publicKey),
        secretKey: toBase64(keyPair.secretKey)
    };
}
export function generateSignedPreKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: toBase64(keyPair.publicKey),
        secretKey: toBase64(keyPair.secretKey)
    };
}

export function signPreKey(spkPublicKeyBase64, ikSecretKeyBase64) {
    const spkPubKeyUint8 = fromBase64(spkPublicKeyBase64);
    const ikSecretUint8 = fromBase64(ikSecretKeyBase64);
    const signingKeyPair = nacl.sign.keyPair.fromSeed(ikSecretUint8);
    const signatureUint8 = nacl.sign.detached(spkPubKeyUint8, signingKeyPair.secretKey);
    return toBase64(signatureUint8);
}

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

export function computeDH(myPrivateKeyBase64, theirPublicKeyBase64){
    const myPriv = util.decodeBase64(myPrivateKeyBase64);
    const theirPub = util.decodeBase64(theirPublicKeyBase64);
    const sharedSecret = nacl.scalarMult(myPriv, theirPub);
    return util.encodeBase64(sharedSecret);
}

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