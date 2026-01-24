import { useState } from "react";
import axios from "axios";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:8000/login", {
        username,
        password,
      });
      setMessage(`Welcome ${res.data.username}`);
    } catch (err) {
      setMessage("Login failed");
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow w-80">
      <h2 className="text-xl font-bold mb-4 text-center">Login</h2>

      <input
        className="w-full border p-2 mb-2"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        className="w-full border p-2 mb-4"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="w-full bg-blue-500 text-white p-2 rounded"
        onClick={handleLogin}
      >
        Login
      </button>

      {message && (
        <p className="text-center text-sm mt-3 text-gray-600">{message}</p>
      )}
    </div>
  );
}

export default Login;
