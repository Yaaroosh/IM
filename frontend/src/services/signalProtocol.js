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

        // Generate all key pairs
        const ik = crypto.generateKeyPair();
        const spk = crypto.generateKeyPair();
        const opks = crypto.generateOneTimePreKeys(50);
        
        // Sign the SPK with the IK
        const signature = crypto.signPreKey(spk.publicKey, ik.secretKey);

        // Save private keys to local storage
        const myPrivateKeys = {
            ik: ik.secretKey,
            spk: spk.secretKey,
            opks: opks.map(k => ({
                key_id: k.key_id,
                secretKey: k.secretKey
            }))
        };
        storage.saveMyKeys(userId, myPrivateKeys, "Initial Registration");

        // Prepare the public bundle exactly as keys.py expects for POST
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

        // Upload to server
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
// Initiates an X3DH handshake to establish the initial Root Key with a contact. 
export async function startSessionWithContact(myUserId, contactId) {
    try {
        console.log(`Starting X3DH handshake with ${contactId}`);

        // Retrieve my local private keys
        const myKeys = storage.getMyKeys(myUserId);
        if (!myKeys) throw new Error("No local keys found. Register first.");

        // Fetch contact's public bundle from the server
        const response = await axios.get(`${API_BASE_URL}/keys/${contactId}`);
        const contactBundle = response.data;

        // Generate an Ephemeral Key for this session
        const myEphemeralKey = crypto.generateKeyPair(); 

        // Calculate Diffie-Hellman shared secrets
        const dh1 = crypto.computeDH(myKeys.ik, contactBundle.signed_prekey.public_key);
        const dh2 = crypto.computeDH(myEphemeralKey.secretKey, contactBundle.identity_key);
        const dh3 = crypto.computeDH(myEphemeralKey.secretKey, contactBundle.signed_prekey.public_key);

        console.log("%c[SENDER DEBUG] DH1:", "color: #3b82f6", dh1);
        console.log("%c[SENDER DEBUG] DH2:", "color: #3b82f6", dh2);
        console.log("%c[SENDER DEBUG] DH3:", "color: #3b82f6", dh3);
        
        let dh4 = "";
        let usedOpkId = null;
        
        // Fetch One-Time PreKey
        if (contactBundle.onetime_prekey) {
            const contactOpk = contactBundle.onetime_prekey; 
            dh4 = crypto.computeDH(myEphemeralKey.secretKey, contactOpk.public_key);
            usedOpkId = contactOpk.key_id;
        }

        console.log("%c[SENDER DEBUG] DH4:", "color: #3b82f6", dh4 || "EMPTY/NULL");

        // X3DH: Deriving the starting Root Key of the entire Double Ratchet session
        const initialRootKey = crypto.deriveInitialRootKey(dh1, dh2, dh3, dh4);

        // Generate our first Ratchet Key Pair for the DH Ratchet
        const myRatchetKey = crypto.generateKeyPair();

        const sessionState ={
            rootKey: initialRootKey,
            sendingChain: null,
            receivingChain: null,
            ourRatchetKey: myRatchetKey,
            theirRatchetPublicKey: contactBundle.signed_prekey.public_key
        }

        // Save the session state in local storage
        storage.saveSessionState(myUserId, contactId, sessionState);
        
        console.log(`X3DH complete! Chain Key established with ${contactId}`);

        console.log("%c[SENDER] Initial Root Key:", "color: orange", initialRootKey);
        
        return {
            ephemeralPublicKey: myEphemeralKey.publicKey,
            ratchetPublicKey: myRatchetKey.publicKey,
            usedOpkId: usedOpkId
        };

    } catch (error) {
        console.error(`Handshake failed with ${contactId}:`, error);
        throw error;
    }
}

// Receiver side: Completes the X3DH key exchange using the sender's ephemeral key and optional OPK ID attached to the first message
export async function initializeSessionAsReceiver(myUserId, contactId, theirEphemeralKey, theirIdentityKey, theirRatchetKey,theirOpkId = null) {
    try {
        console.log(`Initializing incoming session from contact: ${contactId}`);

        // Retrieve my local private keys
        const myKeys = storage.getMyKeys(myUserId);
        if (!myKeys) throw new Error("Local keys missing. Please register first.");

        // Calculate the 4 DH shared secrets from the receiver's perspective
        const dh1 = crypto.computeDH(myKeys.spk, theirIdentityKey);
        const dh2 = crypto.computeDH(myKeys.ik, theirEphemeralKey);
        const dh3 = crypto.computeDH(myKeys.spk, theirEphemeralKey);

        console.log("%c[RECEIVER DEBUG] DH1:", "color: #10b981", dh1);
        console.log("%c[RECEIVER DEBUG] DH2:", "color: #10b981", dh2);
        console.log("%c[RECEIVER DEBUG] DH3:", "color: #10b981", dh3);

        // DH4 - Only if an OPK was used
        let dh4 = "";
        if (theirOpkId !== null && theirOpkId !== undefined) {
            const myOpk = myKeys.opks.find(k => String(k.key_id) === String(theirOpkId));
            
            if (myOpk) {
                dh4 = crypto.computeDH(myOpk.secretKey, theirEphemeralKey);
            } else {
                throw new Error("Missing required OPK for decryption.");
            }
        }

        console.log("%c[RECEIVER DEBUG] DH4:", "color: #10b981", dh4 || "EMPTY/NULL");

        // Derive the exact same initial Root Key
        const initialRootKey = crypto.deriveInitialRootKey(dh1, dh2, dh3, dh4);
        console.log(`Session with ${contactId} successfully established as receiver.`);
        console.log("%c[RECEIVER] Initial Root Key:", "color: orange", initialRootKey);

        const myFirstRatchetKey = crypto.generateKeyPair();

        const sessionState = {
            rootKey: initialRootKey,
            sendingChain: null,
            receivingChain: null,
            ourRatchetKey: myFirstRatchetKey, // Generate our first Ratchet Key Pair
            theirRatchetPublicKey: theirRatchetKey
        };

        // First DH Ratchet step: Creates the initial chain for receiving the first message
        const dhInitial = crypto.computeDH(myKeys.spk, theirRatchetKey);
        const { nextRootKey, nextChainKey: initialChainKey } = crypto.kdfRK(sessionState.rootKey, dhInitial);
        sessionState.rootKey = nextRootKey;

        console.log(`%c[ROOT] Root Key advanced for first RECEIVING chain: ${sessionState.rootKey}`, "color: #ec4899; font-weight: bold");

        sessionState.receivingChain = {
            chainKey: initialChainKey,
            messageNumber: 0
        }

        // Save the established session state
        storage.saveSessionState(myUserId, contactId, sessionState);
        
        if (theirOpkId !== null && theirOpkId !== undefined) {
            storage.removeUsedOPK(myUserId, theirOpkId);
        }

        return sessionState;

    } catch (error) {
        console.error("Failed to initialize receiver session:", error);
        throw error;
    }
}


// ==========================================
// 3. Encrypted Message
// ==========================================
//Encrypts a message using the Double Ratchet (advances both Root and Chain keys)
export async function encryptOutgoingMessage(myUserId, contactId, plaintext) {
    try {
        let session = storage.getSessionState(myUserId, contactId);
        
        // ASYMMETRIC RATCHET: If this is the first message after session establishment, we need to perform the initial DH Ratchet step
        if (!session.sendingChain) {
            const dhResult = crypto.computeDH(session.ourRatchetKey.secretKey, session.theirRatchetPublicKey);
            const { nextRootKey, nextChainKey: initialChainKey } = crypto.kdfRK(session.rootKey, dhResult);
            
            session.rootKey = nextRootKey;

            console.log(`%c[ROOT] Root Key advanced for first sending chain: ${session.rootKey}`, "color: #ec4899; font-weight: bold");

            session.sendingChain = {
                chainKey: initialChainKey,
                messageNumber: 0
            };
        }
        
        // SYMMETRIC RATCHET: Derives a new unique Message Key for every single message
        const { messageKey, nextChainKey } = crypto.kdfCK(session.sendingChain.chainKey);

        console.log(`%c[SENDER] Chain Ratchet Step: ${session.sendingChain.messageNumber}`, "color: #6366f1; font-weight: bold");
        console.log(`%c[SENDER] Message Key (Derived): ${messageKey}`, "color: blue; font-weight: bold");
        console.log(`%c[SENDER] Next Chain Key (Saved): ${nextChainKey}`, "color: #818cf8; font-style: italic");

        session.sendingChain.chainKey = nextChainKey;
        session.sendingChain.messageNumber++;
        storage.saveSessionState(myUserId, contactId, session);


        console.log(`%c[SENDER] Message Key: ${messageKey}`, "color: blue; font-weight: bold");

        // encrypts the plaintext
        const encryptedData = crypto.encryptMessage(plaintext, messageKey);
        console.log("Encrypted payload:", encryptedData);

        return {
            ciphertext: encryptedData.ciphertext,
            nonce: encryptedData.nonce,
            ratchetKey: session.ourRatchetKey.publicKey
        };

    } catch (error) {
        console.error("Critical Encryption Error:", error);
        throw error;
    }
}


const decryptedCache = new Set();
// ==========================================
// 4. Decrypt Received Message
// ==========================================
// Decrypts a message and advances the ratchets based on the sender's ratchet key.
export async function decryptReceivedMessage(myUserId, contactId, ciphertext, nonce, theirRatchetPublicKey, msgId) {
    if (msgId && decryptedCache.has(msgId)) {
        throw new Error("ALREADY_DECRYPTED"); 
    }

    try {
        let session = storage.getSessionState(myUserId, contactId);

        if (!session) {
            throw new Error(`No active session`);
        }

        // ASYMMETRIC RATCHET: Detects if the sender has advanced their ratchet key
        const isNewRatchetKey = theirRatchetPublicKey !== session.theirRatchetPublicKey;

        if (isNewRatchetKey) {
            console.log("%c[RATCHET] Detected new ratchet key. Advancing the ratchet...", "color: #10b981; font-weight: bold");
            const dhResult = crypto.computeDH(session.ourRatchetKey.secretKey, theirRatchetPublicKey);
            const { nextRootKey, nextChainKey: initialChainKey } = crypto.kdfRK(session.rootKey, dhResult);

            session.rootKey = nextRootKey;

            console.log(`%c[ROOT] Root Key updated (Asymmetric Step): ${session.rootKey}`, "color: #ec4899; font-weight: bold");

            session.theirRatchetPublicKey = theirRatchetPublicKey;

            session.receivingChain = {
                chainKey: initialChainKey,
                messageNumber: 0
            };

            // SELF-HEALING: Generates a new local ratchet key for our next reply
            session.ourRatchetKey = crypto.generateKeyPair();
            session.sendingChain = null;
        }

        // SYMMETRIC RATCHET: Advance the symmetric ratchet to generate the message key and the next chain key
        const { messageKey, nextChainKey } = crypto.kdfCK(session.receivingChain.chainKey);

        console.log(`%c[RECEIVER] Chain Ratchet Step: ${session.receivingChain.messageNumber}`, "color: #10b981; font-weight: bold");
        console.log(`%c[RECEIVER] Message Key (Derived): ${messageKey}`, "color: green; font-weight: bold");
        console.log(`%c[RECEIVER] Next Chain Key (Saved): ${nextChainKey}`, "color: #34d399; font-style: italic");

        session.receivingChain.chainKey = nextChainKey;
        session.receivingChain.messageNumber++;
        storage.saveSessionState(myUserId, contactId, session);

        console.log(`%c[RECEIVER] Message Key: ${messageKey}`, "color: green; font-weight: bold");

        if (msgId) decryptedCache.add(msgId);

        // Perform the decryption
        const plaintext = crypto.decryptMessage(ciphertext, nonce, messageKey);

        return plaintext;

    } catch (error) {
        if (error.message !== "ALREADY_DECRYPTED") {
            console.error("Decryption failed:", error);
        }
        throw error;
    }
}