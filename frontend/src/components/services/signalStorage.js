import util from 'tweetnacl-util';



export function savePrivateKey(keyId, privateKeyUint8) { //keyID - e.g IK or SPK or the specific ID of OPK
    const base64Key = util.encodeBase64(privateKeyUint8);
    localStorage.setItem(`privKey_${keyId}`, base64Key);
}

export function getPrivateKey(keyId) { //keyID - e.g IK or SPK or the specific ID of OPK
    const base64Key = localStorage.getItem(`privKey_${keyId}`);
    if (!base64Key) {
        return null;
    }
    return util.decodeBase64(base64Key);
}