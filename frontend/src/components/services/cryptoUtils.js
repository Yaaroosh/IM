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