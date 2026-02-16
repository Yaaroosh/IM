import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export function generateIdentityKeyPair() {
    const keyPair = nacl.sign.keyPair();
    return {
        publicKey: keyPair.publicKey,
        secretKey: keyPair.secretKey
    };
}