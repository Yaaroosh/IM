import { useState } from "react";
import axios from "axios";
import Chat from "./components/Chat";
import Login from "./components/Login"; // YAARA

function App() {
  
  const testNewLogin = new URLSearchParams(window.location.search).get("newLogin") === "1"; // YAARA
  const [user, setUser] = useState(null); // המשתמש המחובר
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false); // האם אנחנו במצב הרשמה?
  const [error, setError] = useState("");

  const handleAuth = async () => {
    setError("");
    const endpoint = isRegister ? "/register" : "/login";
    try {
      const res = await axios.post(`http://localhost:8000${endpoint}`, {
        username,
        password,
      });
      setUser(res.data); // שמירת המשתמש והעברה לצ'אט
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    }
  };

  if (testNewLogin) {// BLOCK YAARA
    return (
      <div className="min-h-screen">
        <Login />
      </div>
    );
  } //END BLOCK YAARA
  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center font-sans">
      {!user ? (
        // --- מסך כניסה / הרשמה ---
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            {isRegister ? "Register" : "Login"}
          </h2>
          
          <input
            className="w-full border p-3 mb-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="w-full border p-3 mb-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 text-white p-3 rounded font-semibold hover:bg-blue-700 transition"
          >
            {isRegister ? "Sign Up" : "Sign In"}
          </button>

          {error && <p className="text-red-500 text-center mt-4 text-sm">{error}</p>}

          <p
            className="text-center mt-4 text-sm text-gray-600 cursor-pointer hover:underline"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? "Already have an account? Login" : "Need an account? Register"}
          </p>
        </div>
      ) : (
        // --- מסך הצ'אט ---
        <div className="w-full h-full">
            <Chat user={user} onLogout={() => setUser(null)} />
        </div>
      )}
    </div>
  );
}

export default App;