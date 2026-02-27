import axios from 'axios';
import * as crypto from './cryptoUtils';
import * as storage from './signalStorage';

// Connects to our FastAPI server running on port 8000
const API_BASE_URL = 'http://localhost:8000'; 

// ==========================================
// 1. Registration (Generate & Upload Keys)
// ==========================================
export async function registerUser(userId) {
    try {
        console.log(`Generating keys for user: ${userId}`);

        // 1. Generate all key pairs
        const ik = crypto.generateKeyPair();
        const spk = crypto.generateKeyPair();
        const opks = crypto.generateOneTimePreKeys(50);
        
        // 2. Sign the SPK with the IK
        const signature = crypto.signPreKey(spk.publicKey, ik.secretKey);

        // 3. Save private keys to local storage
        const myPrivateKeys = {
            ik: ik.secretKey,
            spk: spk.secretKey,
            opks: opks.map(k => ({
                key_id: k.key_id,
                secretKey: k.secretKey
            }))
        };
        storage.saveMyKeys(userId, myPrivateKeys);

        // 4. Prepare the public bundle exactly as keys.py expects for POST
        const publicBundle = {
            identity_key: ik.publicKey,
            signed_prekey: {
                key_id: 1, 
                public_key: spk.publicKey,
                signature: signature
            },
            // Using map to extract ONLY the public keys and their IDs
            onetime_prekeys: opks.map(k => ({
                key_id: k.key_id,
                public_key: k.publicKey
            }))
        };

        // 5. Upload to server
        await axios.post(`${API_BASE_URL}/keys/upload/${userId}`, publicBundle);
        console.log("Registration complete! Public keys uploaded.");
        return true;

    } catch (error) {
        console.error("Failed to register user:", error);
        throw error;
    }
}

// ==========================================
// 2. X3DH Handshake (Start Session)
// ==========================================
export async function startSessionWithContact(myUserId, contactId) {
    try {
        console.log(`Starting X3DH handshake with ${contactId}`);

        // 1. Retrieve my local keys
        const myKeys = storage.getMyKeys(myUserId);
        if (!myKeys) throw new Error("No local keys found. Register first.");

        // 2. Fetch contact's public bundle from the server
        const response = await axios.get(`${API_BASE_URL}/keys/${contactId}`);
        const contactBundle = response.data;

        // 3. Generate an Ephemeral Key for this session
        const myEphemeralKey = crypto.generateKeyPair(); 

        // 4. Calculate Diffie-Hellman shared secrets
        const dh1 = crypto.computeDH(myKeys.ik, contactBundle.signed_prekey.public_key);
        const dh2 = crypto.computeDH(myEphemeralKey.secretKey, contactBundle.identity_key);
        const dh3 = crypto.computeDH(myEphemeralKey.secretKey, contactBundle.signed_prekey.public_key);
        
        let dh4 = "";
        let usedOpkId = null;
        
        // 5. Fetch One-Time PreKey (adapted to keys.py which returns a single object!)
        if (contactBundle.onetime_prekey) {
            const contactOpk = contactBundle.onetime_prekey; 
            dh4 = crypto.computeDH(myEphemeralKey.secretKey, contactOpk.public_key);
            usedOpkId = contactOpk.key_id;
        }

        // 6. Derive the initial Chain Key
        const nextChainKey = crypto.deriveInitialChainKey(dh1, dh2, dh3, dh4);

        // 7. Save the session state (Chain Key) in local storage
        storage.saveSessionState(contactId, nextChainKey);
        
        console.log(`X3DH complete! Chain Key established with ${contactId}`);
        
        return {
            ephemeralPublicKey: myEphemeralKey.publicKey,
            usedOpkId: usedOpkId
        };

    } catch (error) {
        console.error(`Handshake failed with ${contactId}:`, error);
        throw error;
    }
}