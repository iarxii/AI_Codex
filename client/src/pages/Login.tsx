import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { config } from "../config";
import ExternalNavbar from "../components/layout/ExternalNavbar";
import ExternalFooter from "../components/layout/ExternalFooter";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Login failed");
      }

      const { access_token } = await response.json();
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", username);
      navigate("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [countdown, setCountdown] = useState(0);

  React.useEffect(() => {
    if (error) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setError("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-transparent text-[var(--text-primary)] font-[Poppins] relative z-10">
      <ExternalNavbar />

      <div className="flex-1 flex items-center justify-center p-6 mt-20">
        <div className="relative z-10 w-full max-w-md p-10 bg-[var(--bg-surface)]/90 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-6 drop-shadow-2xl">
              <img
                src="/media/aicodex-spirit-bird.png"
                alt="AICodex Logo"
                className="w-full h-full object-contain rounded-3xl border-2 border-[var(--accent)]"
              />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] mb-2">
              AI<span className="text-[var(--accent)]">Codex</span>
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              Welcome back, Architect.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
              
              <div className="relative flex items-center justify-center w-8 h-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="transparent"
                    className="text-red-100"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="transparent"
                    strokeDasharray={88}
                    strokeDashoffset={88 - (88 * countdown) / 5}
                    className="text-red-500 transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold">{countdown}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-black/[0.05] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-muted)] text-sm shadow-sm"
                placeholder="Neural•Identity"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-black/[0.05] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-muted)] text-sm shadow-sm"
                placeholder="Neural•Key"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--accent)] text-white rounded-2xl font-bold shadow-xl shadow-[var(--accent)]/20 hover:bg-[var(--accent-hover)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <div className="text-center text-xs font-medium text-[var(--text-secondary)]">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[var(--accent)] hover:underline font-bold"
              >
                Register
              </Link>
            </div>
          </form>
        </div>
      </div>

      <ExternalFooter />
    </div>
  );
};

export default Login;
