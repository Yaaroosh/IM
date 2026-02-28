import { useState } from "react";
import axios from "axios";
import { User, Lock, ArrowRight, MessageSquare, Loader2 } from "lucide-react";
import { registerUser } from "../services/signalProtocol";

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isRegistering ? "register" : "login";
    
    try {
      const res = await axios.post(`http://localhost:8000/${endpoint}`, {
        username,
        password,
      });
      if (isRegistering){
        await registerUser(res.data.id);
      }
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0f172a] text-slate-200 font-sans">
      
      {/* צד שמאל - ויזואלי (מוסתר במובייל) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-900 to-slate-900 items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="relative z-10 text-center px-10">
            <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30 rotate-3 transform hover:rotate-6 transition duration-500">
                <MessageSquare size={48} className="text-white" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">Connect with<br/>Your Friends.</h1>
            <p className="text-blue-200 text-lg max-w-md mx-auto leading-relaxed">
                Secure, fast, and real-time messaging designed for you. Join our community today and start chatting properly.
            </p>
        </div>
        
        {/* עיגולי רקע לקישוט */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
        <div className="absolute top-24 right-24 w-48 h-48 bg-purple-600 rounded-full blur-[80px] opacity-20"></div>
      </div>

      {/* צד ימין - הטופס */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                    {isRegistering ? "Create an account" : "Welcome back"}
                </h2>
                <p className="mt-2 text-slate-400">
                    {isRegistering ? "Please fill in your details to sign up." : "Enter your credentials to access your account."}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                {/* שדה שם משתמש */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Username</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                            <User size={18} />
                        </div>
                        <input
                            type="text"
                            required
                            className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 text-white transition-all outline-none"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                </div>

                {/* שדה סיסמה */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type="password"
                            required
                            className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 text-white transition-all outline-none"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {/* הודעת שגיאה */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                         {error}
                    </div>
                )}

                {/* כפתור שליחה */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3.5 px-4 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <>
                            {isRegistering ? "Sign Up" : "Sign In"}
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </form>

            {/* מעבר בין התחברות להרשמה */}
            <div className="text-center pt-4">
                <p className="text-slate-400">
                    {isRegistering ? "Already have an account?" : "Don't have an account yet?"}{" "}
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError("");
                        }}
                        className="text-blue-400 hover:text-blue-300 font-semibold hover:underline transition-all ml-1"
                    >
                        {isRegistering ? "Log in" : "Create one"}
                    </button>
                </p>
            </div>
        </div>

        {/* קרדיט קטן למטה */}
        <div className="absolute bottom-6 text-slate-600 text-xs">
            &copy; 2026 IM App. Secure & Encrypted.
        </div>
      </div>
    </div>
  );
}

export default Login;