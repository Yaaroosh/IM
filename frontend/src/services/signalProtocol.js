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
        const ik = crypto.generateIdentityKeyPair();
        const spk = crypto.generateSignedPreKeyPair();
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
