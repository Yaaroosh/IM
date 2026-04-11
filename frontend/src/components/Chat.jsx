import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { MessageSquare, Phone, Video, MoreVertical, LogOut } from "lucide-react";
import * as signal from "../services/signalProtocol";
import * as storage from "../services/signalStorage";

const getAvatarColor = (name) => {
    const colors = ["bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

function Chat({ user, onLogout }) {
    const [users, setUsers] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [unreadCounts, setUnreadCounts] = useState({});
    const [myPublicIdentityKey, setMyPublicIdentityKey] = useState(null);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const activeChatRef = useRef(null);
    
    // מנעול למניעת כפל סנכרון במקביל
    const isSyncingRef = useRef(false);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // Fetches the active user list and calculates unread message counts
    const fetchUsers = async () => {
        try {
            const res = await axios.get(`http://localhost:8000/users?current_user_id=${user.id}`);
            setUsers(res.data);
            const counts = {};
            res.data.forEach(u => {
                if (activeChatRef.current && u.id === activeChatRef.current.id) return;
                if (u.unread_count > 0) counts[u.id] = u.unread_count;
            });
            setUnreadCounts(counts);
            return res.data;
        } catch (err) {
            console.error("Error fetching users:", err);
            return [];
        }
    };

    // Fetches and decrypts pending offline messages to ensure continuous ratchet synchronization
    const syncOfflineMessages = async (currentUsers) => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        try {
            const usersWithMessages = currentUsers.filter(u => u.unread_count > 0);
            
            for (const contact of usersWithMessages) {
                const res = await axios.get(`http://localhost:8000/messages/${contact.id}?current_user_id=${user.id}`);
                const sortedMessages = res.data.sort((a, b) => a.id - b.id);
                let decryptedBatch = [];

                for (const msg of sortedMessages) {
                    const historyInStorage = storage.getLocalHistory(user.id, contact.id);
                    const alreadyExists = historyInStorage.some(m => 
                        (m.id && String(m.id) === String(msg.id)) || 
                        (m.temp_id && msg.temp_id && String(m.temp_id) === String(msg.temp_id))
                    );

                    if (alreadyExists) continue;

                    if (String(msg.sender_id) === String(user.id)) {
                        continue;
                    }

                    try {
                        if (msg.ephemeral_public_key) {
                            await signal.initializeSessionAsReceiver(
                                user.id,
                                msg.sender_id,
                                msg.ephemeral_public_key,
                                msg.sender_identity_key,
                                msg.used_opk_id
                            );
                        }

                        const decrypted = await signal.decryptReceivedMessage(user.id, msg.sender_id, msg.ciphertext, msg.nonce, msg.id);
                        const messageObj = { ...msg, content: decrypted };
                        
                        storage.saveLocalMessage(user.id, contact.id, messageObj);
                        decryptedBatch.push(messageObj);

                        await new Promise(r => setTimeout(r, 100)); 
                        
                    } catch (decErr) {
                        if (decErr.message === "ALREADY_DECRYPTED") {
                            console.log(`[UI SYNC] Message ${msg.id} was blocked by ratchet lock, fetching from DB...`);
                            const currentHistory = storage.getLocalHistory(user.id, contact.id);
                            const existingMsg = currentHistory.find(m => String(m.id) === String(msg.id));
                            if (existingMsg) {
                                decryptedBatch.push(existingMsg);
                            }
                        } else {
                            console.error(`Decryption failed for msg ${msg.id}:`, decErr);
                        }
                    }
                }

                if (decryptedBatch.length > 0 && activeChatRef.current && String(contact.id) === String(activeChatRef.current.id)) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const filtered = decryptedBatch.filter(m => !existingIds.has(m.id));
                        return [...prev, ...filtered];
                    });
                }
            }
        } finally {
            isSyncingRef.current = false;
        }
    };

    // Loads local history, clears unread counts, and triggers server synchronization for the selected chat
    const selectUser = async (otherUser) => {
        setActiveChat(otherUser);
        
        const historyFromDisk = storage.getLocalHistory(user.id, otherUser.id);
        setMessages(historyFromDisk);

        setUnreadCounts(prev => {
            const n = { ...prev };
            delete n[otherUser.id];
            return n;
        });

        try {
            await axios.post(`http://localhost:8000/messages/read/${otherUser.id}?current_user_id=${user.id}`);
            
            const res = await axios.get(`http://localhost:8000/messages/${otherUser.id}?current_user_id=${user.id}`);
            
            const trulyNew = res.data.filter(serverMsg => {
                const latestStorage = storage.getLocalHistory(user.id, otherUser.id);
                return !latestStorage.some(localMsg => 
                    (localMsg.id && String(localMsg.id) === String(serverMsg.id)) ||
                    (localMsg.temp_id && serverMsg.temp_id && String(localMsg.temp_id) === String(serverMsg.temp_id))
                );
            });

            if (trulyNew.length > 0 && !isSyncingRef.current) {
                console.log(`[DEBUG] Syncing ${trulyNew.length} truly new messages for ${otherUser.username}`);
                await syncOfflineMessages([{ ...otherUser, unread_count: trulyNew.length }]);
            }
        } catch (err) {
            console.error("Select user sync error:", err);
        }
    };

    // Initializes user fetching, offline synchronization, and establishes the WebSocket connection
    useEffect(() => {
        const init = async () => {
            try {
                const keyRes = await axios.get(`http://localhost:8000/keys/${user.id}`);
                setMyPublicIdentityKey(keyRes.data.identity_key);

                const currentUsers = await fetchUsers();
                await syncOfflineMessages(currentUsers);

                const socket = new WebSocket(`ws://localhost:8000/ws/${user.id}`);
                socketRef.current = socket;

                socket.onmessage = async (event) => {
                    const msg = JSON.parse(event.data);
                    const msgSenderId = Number(msg.sender_id);
                    
                    if (msgSenderId === Number(user.id)) return; 

                    const history = storage.getLocalHistory(user.id, msgSenderId);
                    
                    const alreadyExists = history.some(m => 
                        (m.id && String(m.id) === String(msg.id)) || 
                        (m.temp_id && msg.temp_id && String(m.temp_id) === String(msg.temp_id))
                    );
                    if (alreadyExists) return;

                    try {
                        if (msg.ephemeral_public_key) {
                            await signal.initializeSessionAsReceiver(
                                user.id,
                                msgSenderId,
                                msg.ephemeral_public_key,
                                msg.sender_identity_key,
                                msg.used_opk_id);
                        }

                        const decryptedContent = await signal.decryptReceivedMessage(user.id, msgSenderId, msg.ciphertext, msg.nonce, msg.id);
                        const messageObj = { ...msg, content: decryptedContent, timestamp: new Date().toISOString() };

                        storage.saveLocalMessage(user.id, msgSenderId, messageObj);

                        if (activeChatRef.current && msgSenderId === Number(activeChatRef.current.id)) {
                            axios.post(`http://localhost:8000/messages/read/${msgSenderId}?current_user_id=${user.id}`);
                            setMessages((prev) => [...prev, messageObj]);
                        } else {
                            setUnreadCounts(prev => ({ ...prev, [msgSenderId]: (prev[msgSenderId] || 0) + 1 }));
                            fetchUsers();
                        }
                    } catch (err) {
                        if (err.message === "ALREADY_DECRYPTED") {
                            // IGMORE
                        } else {
                            console.error("WS Decryption error:", err);
                        }
                    }
                };
            } catch (err) {
                console.error("Init failed:", err);
            }
        };

        init();
        const interval = setInterval(fetchUsers, 5000);
        return () => {
            if (socketRef.current) socketRef.current.close();
            clearInterval(interval);
        };
    }, [user.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Encrypts and transmits a new message via WebSocket while saving it to local storage
    const sendMessage = async () => {
        if (!newMessage.trim() || !activeChat) return;
        if (socketRef.current?.readyState !== WebSocket.OPEN) return;

        try {
            const tempId = crypto.randomUUID();
            let handshake = {};
            
            if (!storage.getSessionState(user.id, activeChat.id)) {
                handshake = await signal.startSessionWithContact(user.id, activeChat.id);
            }

            const enc = await signal.encryptOutgoingMessage(user.id, activeChat.id, newMessage);
            const myKeysBundle = storage.getMyKeys(user.id);
            if (!myKeysBundle || !myKeysBundle.ik) {
                console.error("Missing local identity keys!");
                return; 
            }
            const payload = { 
                recipient_id: activeChat.id, 
                ciphertext: enc.ciphertext, 
                nonce: enc.nonce, 
                temp_id: tempId, 
                ephemeral_public_key: handshake.ephemeralPublicKey || null, 
                used_opk_id: handshake.usedOpkId ?? null,
                sender_identity_key: myPublicIdentityKey
            };

            socketRef.current.send(JSON.stringify(payload));
            
            const myMsg = { 
                sender_id: user.id, 
                recipient_id: activeChat.id, 
                content: newMessage, 
                timestamp: new Date().toISOString(), 
                temp_id: tempId 
            };
            storage.saveLocalMessage(user.id, activeChat.id, myMsg);
            setMessages(prev => [...prev, myMsg]);
            setNewMessage("");
        } catch (err) {
            console.error("Send failed:", err);
        }
    };

    return (
        <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
            <div className="w-80 bg-[#1e293b] flex flex-col border-r border-slate-700/50">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(user.username)}`}>
                            {user.username[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-semibold">{user.username}</h3>
                            <p className="text-xs text-green-400">Online</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="p-2 hover:bg-slate-700 rounded-full transition text-slate-400 hover:text-red-400">
                        <LogOut size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2">
                    {users.map((u) => (
                        <div key={u.id} onClick={() => selectUser(u)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChat?.id === u.id ? "bg-slate-700/60" : "hover:bg-slate-800"}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(u.username)}`}>{u.username[0].toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium truncate">{u.username}</h4>
                                    {unreadCounts[u.id] > 0 && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">{unreadCounts[u.id]} new</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-1 flex flex-col bg-[#0f172a]">
                {activeChat ? (
                    <>
                        <div className="h-16 border-b border-slate-700/50 flex items-center px-6 bg-[#1e293b]/50">
                            <span className="font-semibold text-white">{activeChat.username}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${Number(msg.sender_id) === Number(user.id) ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${Number(msg.sender_id) === Number(user.id) ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-700 text-slate-200 rounded-tl-none"}`}>
                                        <p>{msg.content}</p>
                                        <span className="text-[10px] opacity-70 block text-right mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 bg-[#1e293b]/30">
                            <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2 border border-slate-700">
                                <input className="flex-1 bg-transparent focus:outline-none text-slate-200" placeholder="Message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                                <button onClick={sendMessage} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageSquare size={48} className="mb-4 opacity-10" />
                        <h2 className="text-xl font-bold">Select a conversation</h2>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Chat;