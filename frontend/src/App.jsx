import { useState } from "react";
import Chat from "./components/Chat";
import Login from "./components/Login";

function App() {
  const [user, setUser] = useState(null); // המשתמש המחובר

  return (
    <div className="h-screen w-full bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      {!user ? (
        // --- מסך כניסה (החדש) ---
        // אנחנו מעבירים לו פונקציה: "כשמישהו מתחבר בהצלחה, תעדכן את המשתמש פה למעלה"
        <Login onLogin={(loggedInUser) => setUser(loggedInUser)} />
      ) : (
        // --- מסך הצ'אט ---
        <Chat user={user} onLogout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;