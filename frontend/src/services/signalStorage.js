const MY_KEYS_PREFIX = 'signal_keys_';
const SESSION_PREFIX = 'signal_session_';


// Saves the user's private keys bundle (IK, SPK, OPKs) in Local Storage
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
        
        return JSON.parse(serialized); 
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
        keysBundle.opks = keysBundle.opks.filter(k => String(k.key_id) !== String(usedKeyId));

        if (keysBundle.opks.length < originalLength) {
            saveMyKeys(userId, keysBundle);
            console.log(`OPK with ID ${usedKeyId} successfully removed.`);
        }
    } catch (error) {
        console.error("Error removing used OPK:", error);
    }
}


// Saves the current chain key for a specific contact of a specific user
export function saveSessionState(myUserId, contactId, chainKeyBase64) {
    try {
        localStorage.setItem(`${SESSION_PREFIX}${myUserId}_with_${contactId}`, chainKeyBase64);
    } catch (error) {
        console.error(`Error saving session state for contact ${contactId}:`, error);
    }
}


// Loads the current chain key to continue a conversation
export function getSessionState(myUserId, contactId) {
    try {
        return localStorage.getItem(`${SESSION_PREFIX}${myUserId}_with_${contactId}`);
    } catch (error) {
        console.error(`Error loading session state for contact ${contactId}:`, error);
        return null;
    }
}


// Appends a decrypted message to the local chat history
export function saveLocalMessage(currentUserId, contactId, message) {
    const key = `history_${currentUserId}_to_${contactId}`;
    const history = JSON.parse(localStorage.getItem(key) || "[]");
    
    const exists = history.some(m => {
        const isSameTemp = m.temp_id && message.temp_id && m.temp_id === message.temp_id;
        const isSameId = m.id && message.id && m.id === message.id;
        return isSameTemp || isSameId;
    });
    if (!exists) {
        history.push(message);
        localStorage.setItem(key, JSON.stringify(history));
    }
}

// Retrieves the decrypted message history for a specific conversation
export function getLocalHistory(currentUserId, contactId) {
    const key = `history_${currentUserId}_to_${contactId}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
}