import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export function generateIdentityKeyPair() {
    const keyPair = nacl.sign.keyPair();
    return {
        publicKey: keyPair.publicKey,
        secretKey: keyPair.secretKey
    };
}
export function generateSignedPreKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: keyPair.publicKey,
        secretKey: keyPair.secretKey
    };
}

export function signPreKey(spkPublicKey, ikSecretKey) {
    return nacl.sign.detached(spkPublicKey, ikSecretKey);
}

export function generateOneTimePreKeys(count) {
    const opks = [];
    for (let i = 0; i < count; i++) {
        const keyPair = nacl.box.keyPair();
        opks.push({
            id: util.encodeBase64(nacl.randomBytes(4)),
            publicKey: keyPair.publicKey,
            secretKey: keyPair.secretKey
        });
    }
    return opks;
}

export function computeDH(secretKey, publicKey) {
    return nacl.scalarMult(secretKey, publicKey);
}