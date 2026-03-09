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
//===========================================
export async function startSessionWithContact(myUserId, contactId) {
    try {
        console.log(`Starting X3DH handshake with ${contactId}`);

        // 1. Retrieve my local private keys
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

        console.log("%c[SENDER DEBUG] DH1:", "color: #3b82f6", dh1);
        console.log("%c[SENDER DEBUG] DH2:", "color: #3b82f6", dh2);
        console.log("%c[SENDER DEBUG] DH3:", "color: #3b82f6", dh3);
        
        let dh4 = "";
        let usedOpkId = null;
        
        // 5. Fetch One-Time PreKey (adapted to keys.py which returns a single object!)
        if (contactBundle.onetime_prekey) {
            const contactOpk = contactBundle.onetime_prekey; 
            dh4 = crypto.computeDH(myEphemeralKey.secretKey, contactOpk.public_key);
            usedOpkId = contactOpk.key_id;
        }

        console.log("%c[SENDER DEBUG] DH4:", "color: #3b82f6", dh4 || "EMPTY/NULL");

        // 6. Derive the initial Chain Key
        const initialChainKey = crypto.deriveInitialChainKey(dh1, dh2, dh3, dh4);

        // 7. Save the session state (Chain Key) in local storage
        storage.saveSessionState(myUserId, contactId, initialChainKey);
        
        console.log(`X3DH complete! Chain Key established with ${contactId}`);

        // שורת בדיקה קריטית!!!
        console.log("%c[SENDER] Initial Chain Key:", "color: orange", initialChainKey);
        
        return {
            ephemeralPublicKey: myEphemeralKey.publicKey,
            usedOpkId: usedOpkId
        };

    } catch (error) {
        console.error(`Handshake failed with ${contactId}:`, error);
        throw error;
    }
}

// Receiver side: Initialize session from the first incoming message (X3DH)
export async function initializeSessionAsReceiver(myUserId, contactId, theirEphemeralKey, theirIdentityKey, theirOpkId = null) {
    try {
        console.log(`Initializing incoming session from contact: ${contactId}`);

        // 1. Retrieve my local private keys
        const myKeys = storage.getMyKeys(myUserId);
        if (!myKeys) throw new Error("Local keys missing. Please register first.");

        // 2. Calculate the 4 DH shared secrets from the receiver's perspective
        const dh1 = crypto.computeDH(myKeys.spk, theirIdentityKey);
        const dh2 = crypto.computeDH(myKeys.ik, theirEphemeralKey);
        const dh3 = crypto.computeDH(myKeys.spk, theirEphemeralKey);

        console.log("%c[RECEIVER DEBUG] DH1:", "color: #10b981", dh1);
        console.log("%c[RECEIVER DEBUG] DH2:", "color: #10b981", dh2);
        console.log("%c[RECEIVER DEBUG] DH3:", "color: #10b981", dh3);

        // DH4 - Only if an OPK was used
        let dh4 = "";
        if (theirOpkId !== null && theirOpkId !== undefined) {
            console.log(`[RECEIVER] Searching for OPK ID: ${theirOpkId}`);
            const myOpk = myKeys.opks.find(k => String(k.key_id) === String(theirOpkId));
            if (myOpk) {
                dh4 = crypto.computeDH(myOpk.secretKey, theirEphemeralKey);
                console.log("%c[RECEIVER] DH4 Computed Successfully!", "color: green");
            }else{
                console.error(`%c[RECEIVER] OPK ID ${theirOpkId} not found in my storage!`, "color: red");
            }
        }else{
            console.warn("[RECEIVER] No OPK ID was provided in the handshake message.");
        }
        
        console.log("%c[RECEIVER DEBUG] DH4:", "color: #10b981", dh4 || "EMPTY/NULL");

        // 3. Derive the exact same initial Chain Key
        const initialChainKey = crypto.deriveInitialChainKey(dh1, dh2, dh3, dh4);

        // 4. Save the established session state
        storage.saveSessionState(myUserId, contactId, initialChainKey);
        
        if (theirOpkId) {
            storage.removeUsedOPK(myUserId, theirOpkId);
        }
        
        console.log(`Session with ${contactId} successfully established as receiver.`);

        // שורת בדיקה קריטית!!!
        console.log("%c[RECEIVER] Initial Chain Key:", "color: orange", initialChainKey);

        return initialChainKey;

    } catch (error) {
        console.error("Failed to initialize receiver session:", error);
        throw error;
    }
}


// ==========================================
// 3. Encrypted Message
// ==========================================
export async function encryptOutgoingMessage(myUserId, contactId, plaintext) {
    try {
        let currentChainKey = storage.getSessionState(myUserId, contactId);
        
        if (!currentChainKey) {
            throw new Error(`No active session with ${contactId}.`);
        }

        // שלב הראצ'ט
        const derived = crypto.deriveNextKeys(currentChainKey);
        console.log("Derived keys:", derived); 

        if (!derived || !derived.messageKey) {
            throw new Error("Failed to derive Message Key");
        }

        // שורת בדיקה קריטית!!!
        console.log(`%c[SENDER] Message Key: ${derived.messageKey}`, "color: blue; font-weight: bold");

        // שלב ההצפנה
        const encryptedData = crypto.encryptMessage(plaintext, derived.messageKey);
        console.log("Encrypted payload:", encryptedData);

        // שורת בדיקה קריטית!!!
        console.log(`%c[SENDER] Nonce: ${encryptedData.nonce}`, "color: blue");

        // עדכון ה-Storage
        storage.saveSessionState(myUserId, contactId, derived.nextChainKey);

        return {
            ciphertext: encryptedData.ciphertext,
            nonce: encryptedData.nonce
        };

    } catch (error) {
        // כאן נראה את השגיאה המפורטת ב-Console
        console.error("Critical Failure in encryptOutgoingMessage:", error);
        throw error;
    }
}


const decryptedCache = new Set();
// ==========================================
// 4. Decrypt Received Message
// ==========================================
export async function decryptReceivedMessage(myUserId, contactId, ciphertext, nonce, msgId) {
    // מנעול זיכרון: אם ה-ID הזה כבר עבר פה בסשן הנוכחי, עוצרים מיד!
    if (msgId && decryptedCache.has(msgId)) {
        console.warn(`%c[BLOCKER] Message ${msgId} already decrypted! Stopping double ratchet.`, "color: #fbbf24; font-weight: bold;");
        // זורקים שגיאה ייעודית שתיתפס ב-Chat.jsx בלי להרוס את הראצ'ט
        throw new Error("ALREADY_DECRYPTED"); 
    }

    try {
        let currentChainKey = storage.getSessionState(myUserId, contactId);

        if (!currentChainKey) {
            throw new Error(`No active session`);
        }

        // קידום הראצ'ט 
        const { messageKey, nextChainKey } = crypto.deriveNextKeys(currentChainKey);

        console.log(`%c[RECEIVER] Message Key: ${messageKey}`, "color: green; font-weight: bold");
        console.log(`%c[RECEIVER] Nonce from msg: ${nonce}`, "color: green");

        // עדכון ה-Storage במפתח החדש
        storage.saveSessionState(myUserId, contactId, nextChainKey);

        // מוסיפים את ההודעה ל"רשימה השחורה" כדי שלא תפוענח שוב
        if (msgId) decryptedCache.add(msgId);

        // פענוח בפועל
        const plaintext = crypto.decryptMessage(ciphertext, nonce, messageKey);

        return plaintext;

    } catch (error) {
        if (error.message !== "ALREADY_DECRYPTED") {
            console.error("Decryption failed:", error);
        }
        throw error;
    }
}