import { useState, useEffect, useRef } from "react";
import axios from "axios";

function Chat({ user, onLogout }) {
  const [users, setUsers] = useState([]); // רשימת משתמשים
  const [activeChat, setActiveChat] = useState(null); // עם מי אני מדבר עכשיו
  const [messages, setMessages] = useState([]); // היסטוריית הודעות
  const [newMessage, setNewMessage] = useState(""); // הטקסט בתיבת הכתיבה
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null); // רפרנס לגלילה אוטומטית למטה

  // 1. טעינת משתמשים וחיבור ל-WebSocket בעלייה
  useEffect(() => {
    // שליפת רשימת משתמשים (חוץ ממני)
    axios.get(`http://localhost:8000/users?current_user_id=${user.id}`)
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Error fetching users:", err));

    // חיבור ל-WebSocket
    const socket = new WebSocket(`ws://localhost:8000/ws/${user.id}`);
    
    socket.onopen = () => {
      console.log("Connected to WebSocket");
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("New message received:", msg); // לדיבוג
      // הוספת ההודעה למסך בזמן אמת
      setMessages((prev) => [...prev, msg]);
    };

    socketRef.current = socket;

    // ניתוק ביציאה
    return () => {
      socket.close();
    };
  }, [user.id]);

  // גלילה למטה כשיש הודעה חדשה
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  // 2. בחירת משתמש לשיחה
  const selectUser = async (otherUser) => {
    setActiveChat(otherUser);
    try {
      // שליפת היסטוריה מהשרת
      const res = await axios.get(`http://localhost:8000/messages/${otherUser.id}?current_user_id=${user.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // 3. שליחת הודעה
  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;

    const payload = {
      recipient_id: activeChat.id,
      content: newMessage
    };

    // שליחה לשרת דרך הסוקט
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
    } else {
        console.error("WebSocket is not open");
        return;
    }

    // הוספה מקומית למסך שלי (כדי שאראה את מה שכתבתי מיד)
    setMessages((prev) => [
      ...prev,
      { 
        sender_id: user.id, 
        recipient_id: activeChat.id, 
        content: newMessage, 
        timestamp: new Date().toISOString() 
      }
    ]);
    
    setNewMessage("");
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar - רשימת משתמשים */}
      <div className="w-1/3 bg-white border-r flex flex-col">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h2 className="font-bold text-lg text-gray-700">{user.username}</h2>
          <button onClick={onLogout} className="text-red-500 text-sm font-semibold hover:text-red-700">Logout</button>
        </div>
        <div className="flex-1 overflow-y-auto">
            <h3 className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Contacts</h3>
            {users.map((u) => (
            <div
              key={u.id}
              onClick={() => selectUser(u)}
              className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition ${activeChat?.id === u.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
            >
              <p className="font-medium text-gray-800">{u.username}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="w-2/3 flex flex-col bg-gray-200">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-4 bg-white shadow-sm z-10">
              <h3 className="text-lg font-bold text-gray-800">{activeChat.username}</h3>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {messages.map((msg, idx) => {
                
                // --- התיקון הקריטי: המרה למספרים ---
                const s_id = Number(msg.sender_id);
                const r_id = Number(msg.recipient_id);
                const my_id = Number(user.id);
                const chat_id = Number(activeChat.id);

                const isCurrentChat = 
                  (s_id === my_id && r_id === chat_id) || // הודעה שאני שלחתי בשיחה הזו
                  (s_id === chat_id && r_id === my_id) || // הודעה שקיבלתי בשיחה הזו
                  (s_id === chat_id); // מגן למקרה שהסוקט שולח בלי נמען ברור

                if (!isCurrentChat) return null;

                const isMe = s_id === my_id;
                
                return (
                  <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-sm text-sm ${
                      isMe ? "bg-blue-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none"
                    }`}>
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 text-right ${isMe ? "text-blue-100" : "text-gray-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t flex gap-2">
              <input
                className="flex-1 border p-3 rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage} 
                className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition shadow-md"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xl font-medium">Select a contact to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;