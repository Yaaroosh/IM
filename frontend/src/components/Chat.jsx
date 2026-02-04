import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { MessageSquare, Phone, Video, MoreVertical, LogOut } from "lucide-react";

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
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/users?current_user_id=${user.id}`);
      setUsers(res.data);
      const counts = {};
      res.data.forEach(u => {
        // --- תיקון 1: המגן הויזואלי ---
        // אם יש הודעות שלא נקראו, אבל זה המשתמש שאני בשיחה איתו כרגע -> תתעלם מהמונה
        if (activeChat && u.id === activeChat.id) {
            return; 
        }
        
        if (u.unread_count > 0) counts[u.id] = u.unread_count;
      });
      setUnreadCounts(counts); 
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

    fetchUsers();

    const socket = new WebSocket(`ws://localhost:8000/ws/${user.id}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      const msgSenderId = Number(msg.sender_id);
      const currentActiveId = activeChat ? Number(activeChat.id) : null;

      // --- תיקון 2: עדכון השרת ---
      // אם קיבלנו הודעה ממי שאנחנו מדברים איתו כרגע, נשלח בקשה מהירה לסמן אותה כ"נקראה"
      if (activeChat && msgSenderId === currentActiveId) {
          try {
            axios.get(`http://localhost:8000/messages/${msgSenderId}?current_user_id=${user.id}`);
          } catch (e) {
            console.error("Failed to mark read silently");
          }
      }

      setMessages((prevMessages) => {
          // סינון כפילויות (UUID)
          if (msg.temp_id && prevMessages.some(m => m.temp_id === msg.temp_id)) {
              return prevMessages; 
          }

          // הוספה למסך אם רלוונטי
          const myId = Number(user.id);
          if (activeChat && (msgSenderId === currentActiveId || msgSenderId === myId)) {
             return [...prevMessages, msg];
          }
          return prevMessages;
      });
      
      fetchUsers(); 
    };

    const intervalId = setInterval(fetchUsers, 3000);

    return () => {
      socket.close();
      clearInterval(intervalId);
    };
  }, [user.id, activeChat]); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectUser = async (otherUser) => {
    setActiveChat(otherUser);
    setUnreadCounts((prev) => {
        const newCounts = { ...prev };
        delete newCounts[otherUser.id];
        return newCounts;
    });

    try {
      const res = await axios.get(`http://localhost:8000/messages/${otherUser.id}?current_user_id=${user.id}`);
      setMessages(res.data);
      fetchUsers();
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;
    
    const tempId = crypto.randomUUID(); 

    const payload = { 
        recipient_id: activeChat.id, 
        content: newMessage,
        temp_id: tempId 
    };
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
        
        setMessages((prev) => [...prev, { 
            sender_id: user.id, 
            recipient_id: activeChat.id, 
            content: newMessage, 
            timestamp: new Date().toISOString(),
            temp_id: tempId 
        }]);
        
        setNewMessage("");
    }
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      
      {/* סרגל צד */}
      <div className="w-80 bg-[#1e293b] flex flex-col border-r border-slate-700/50">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(user.username)}`}>
                    {user.username[0].toUpperCase()}
                </div>
                <div>
                    <h3 className="font-semibold text-white">{user.username}</h3>
                    <p className="text-xs text-green-400 flex items-center gap-1">Online</p>
                </div>
            </div>
            <button onClick={onLogout} title="Logout" className="p-2 hover:bg-slate-700 rounded-full transition text-slate-400 hover:text-red-400">
                <LogOut size={18} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2">
            {users.map((u) => (
                <div 
                    key={u.id} 
                    onClick={() => selectUser(u)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent
                        ${activeChat?.id === u.id ? "bg-slate-700/60 border-slate-600" : "hover:bg-slate-800"}`}
                >
                    <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(u.username)}`}>
                            {u.username[0].toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1e293b] rounded-full"></span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                            <h4 className={`font-medium truncate ${unreadCounts[u.id] ? "text-white font-bold" : "text-slate-200"}`}>
                                {u.username}
                            </h4>
                            {unreadCounts[u.id] > 0 && (
                                <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                                    {unreadCounts[u.id]}
                                </span>
                            )}
                        </div>
                        <p className={`text-xs truncate ${unreadCounts[u.id] ? "text-blue-300 font-medium" : "text-slate-400"}`}>
                            {unreadCounts[u.id] ? "New message!" : "Click to chat"}
                        </p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* צ'אט */}
      <div className="flex-1 flex flex-col bg-[#0f172a] relative">
        {activeChat ? (
            <>
                <div className="h-16 border-b border-slate-700/50 flex items-center justify-between px-6 bg-[#1e293b]/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${getAvatarColor(activeChat.username)}`}>
                            {activeChat.username[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{activeChat.username}</span>
                    </div>
                    <div className="flex gap-4 text-slate-400">
                        <Phone size={20} className="cursor-pointer hover:text-white transition"/>
                        <Video size={20} className="cursor-pointer hover:text-white transition"/>
                        <MoreVertical size={20} className="cursor-pointer hover:text-white transition"/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {messages.map((msg, idx) => {
                         const isMe = Number(msg.sender_id) === Number(user.id);
                         return (
                            <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm relative ${
                                    isMe ? "bg-blue-600 text-white rounded-tr-sm" : "bg-slate-700 text-slate-200 rounded-tl-sm"
                                }`}>
                                    <p>{msg.content}</p>
                                    <span className="text-[10px] opacity-70 block text-right mt-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                         );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-[#1e293b]/30">
                    <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2 border border-slate-700">
                        <input 
                            className="flex-1 bg-transparent border-none focus:outline-none text-slate-200 placeholder-slate-500 py-2"
                            placeholder={`Message ${activeChat.username}...`}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button onClick={sendMessage} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
                     <MessageSquare size={32} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Select a conversation</h2>
                <p className="text-slate-400">Choose a contact to start messaging.</p>
            </div>
        )}
      </div>
    </div>
  );
}

export default Chat;