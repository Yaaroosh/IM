import { useMemo, useState } from "react";
import axios from "axios";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" }); // type: "success" | "error" | ""
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(
    () => username.trim().length >= 2 && password.length >= 4 && !loading,
    [username, password, loading]
  );

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setStatus({ type: "", text: "" });

    try {
      const res = await axios.post("http://localhost:8000/login", {
        username: username.trim(),
        password,
      });

      setStatus({ type: "success", text: `Welcome back, ${res.data.username} 👋` });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setStatus({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center px-4">

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-white/70 via-white/30 to-white/70" />

          <div className="p-6 sm:p-8">
            {/* Brand */}
            <div className="flex items-center justify-center gap-3 mb-6">
             
              <div className="text-center">
                <h1 className="text-2xl font-semibold text-white leading-tight">
                  Chatty
                </h1>
                <p className="text-white/80 text-sm">
                  a chat app for chatty people
                </p>
              </div>
            </div>

            <h2 className="text-white text-lg font-semibold mb-1">Login</h2>
            <p className="text-white/75 text-sm mb-6">
              Sign in to start chatting!
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm text-white/80 mb-1">
                  Username
                </label>
                <input
                  className="w-full rounded-xl bg-white/20 border border-white/25 px-4 py-3 text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 transition"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-white/80 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl bg-white/20 border border-white/25 px-4 py-3 pr-12 text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 transition"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-2 px-3 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Status message */}
              {status.text && (
                <div
                  className={[
                    "rounded-xl px-4 py-3 text-sm border",
                    status.type === "success"
                      ? "bg-emerald-500/15 text-emerald-100 border-emerald-300/30"
                      : "bg-rose-500/15 text-rose-100 border-rose-300/30",
                  ].join(" ")}
                >
                  {status.text}
                </div>
              )}

              {/* Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  "w-full rounded-xl py-3 font-semibold shadow-lg transition",
                  "bg-white text-indigo-700 hover:bg-white/95",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              {/* Small footer */}
              <div className="flex items-center justify-between text-xs text-white/75 pt-2">
                <button
                  type="button"
                  className="hover:text-white transition"
                  onClick={() =>
                    setStatus({
                      type: "error",
                      text: "Forgot password flow not implemented yet.",
                    })
                  }
                >
                  Forgot password?
                </button>
                
              </div>
            </form>
          </div>
        </div>

        {/* Bottom note */}
        
      </div>
    </div>
  );
}

export default Login;
