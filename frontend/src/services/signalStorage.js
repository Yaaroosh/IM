const MY_KEYS_PREFIX = 'signal_keys_';
const SESSION_PREFIX = 'signal_session_';


// Saves the user's private keys bundle (IK, SPK, OPKs)
export function saveMyKeys(userId, keys) {
    try {
        const serialized = JSON.stringify(keys);
        localStorage.setItem(`${MY_KEYS_PREFIX}${userId}`, serialized);
        console.log(`My keys successfully saved for user: ${userId}`);
    } catch (error) {
        console.error("Error saving my keys:", error);
    }
}

// Retrieves the user's private keys bundle
export function getMyKeys(userId) {
    try {
        const serialized = localStorage.getItem(`${MY_KEYS_PREFIX}${userId}`);
        if (!serialized) return null;
        const keys = JSON.parse(serialized);

        return {
            ik: new Uint8Array(Object.values(keys.ik)),
            spk: new Uint8Array(Object.values(keys.spk)),
            opks: keys.opks.map(k => ({
                key_id: k.key_id,
                secretKey: new Uint8Array(Object.values(k.secretKey))
            }))
        };
    } catch (error) {
        console.error("Error loading my keys:", error);
        return null;
    }
}


// Removes a specific OPK after it was used to establish a new session
export function removeUsedOPK(userId, usedKeyId) {
    try {
        const keysBundle = getMyKeys(userId);
        if (!keysBundle || !keysBundle.opks) return;

        const originalLength = keysBundle.opks.length;
        keysBundle.opks = keysBundle.opks.filter(k => k.key_id !== usedKeyId);

        if (keysBundle.opks.length < originalLength) {
            saveMyKeys(userId, keysBundle);
            console.log(`OPK with ID ${usedKeyId} successfully removed.`);
        }
    } catch (error) {
        console.error("Error removing used OPK:", error);
    }
}


// Saves the current chain key for a specific contact
export function saveSessionState(contactId, chainKeyBase64) {
    try {
        localStorage.setItem(`${SESSION_PREFIX}${contactId}`, chainKeyBase64);
    } catch (error) {
        console.error(`Error saving session state for contact ${contactId}:`, error);
    }
}


// Loads the current chain key to continue a conversation
export function getSessionState(contactId) {
    try {
        return localStorage.getItem(`${SESSION_PREFIX}${contactId}`);
    } catch (error) {
        console.error(`Error loading session state for contact ${contactId}:`, error);
        return null;
    }
}

// Clears all Signal-related data from local storage on logout
export function clearAllStorage() {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(MY_KEYS_PREFIX) || key.startsWith(SESSION_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log("All Signal storage cleared successfully.");
    } catch (error) {
        console.error("Error clearing Signal storage:", error);
    }
}