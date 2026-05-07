import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { config } from "../config";
import ExternalNavbar from "../components/layout/ExternalNavbar";
import ExternalFooter from "../components/layout/ExternalFooter";
import { 
  UserIcon, 
  LockClosedIcon, 
  IdentificationIcon, 
  BriefcaseIcon,
  GlobeEuropeAfricaIcon,
  CalendarDaysIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    title: "",
    first_name: "",
    surname: "",
    dob: "",
    gender: "",
    pronouns: "Prefer not to say",
    country: "",
    profession: ""
  });
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Registration failed");
      }

      const { access_token } = await response.json();
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", formData.username);
      navigate("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "w-full px-4 py-3 bg-white/50 border border-black/[0.08] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-muted)] text-sm shadow-sm backdrop-blur-sm";
  const labelStyles = "block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-1.5 ml-1";

  return (
    <div className="flex flex-col min-h-screen bg-transparent text-[var(--text-primary)] font-[Poppins] relative z-10">
      <ExternalNavbar />

      <div className="flex-1 flex items-center justify-center p-6 mt-20 mb-20">
        <div className="relative z-10 w-full max-w-2xl p-8 lg:p-12 bg-[var(--bg-surface)]/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]">
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 relative group">
              <div className="absolute inset-0 bg-[var(--accent)] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <img
                src="/media/aicodex-spirit-bird.png"
                alt="AICodex Logo"
                className="w-full h-full object-contain rounded-2xl border-2 border-[var(--accent)] relative z-10"
              />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] mb-2">
              Neural <span className="text-[var(--accent)]">Architect</span> Registration
            </h1>
            <p className="text-[var(--text-secondary)] font-medium max-w-sm mx-auto leading-relaxed">
              Define your identity within the AI Codex collective.
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50/80 backdrop-blur-md border border-red-200 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section 1: Account Credentials */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <LockClosedIcon className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">Core Access</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className={labelStyles}>Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      className={`${inputStyles} pl-11`}
                      placeholder="nexus_architect"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelStyles}>Password</label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`${inputStyles} pl-11`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-black/[0.05] w-full"></div>

            {/* Section 2: Personal Identity */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <IdentificationIcon className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">Biometric Profile</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5 md:col-span-1">
                  <label className={labelStyles}>Title</label>
                  <select name="title" value={formData.title} onChange={handleChange} className={inputStyles} required>
                    <option value="">Select...</option>
                    <option value="Mr">Mr.</option>
                    <option value="Ms">Ms.</option>
                    <option value="Mx">Mx.</option>
                    <option value="Dr">Dr.</option>
                    <option value="Prof">Prof.</option>
                    <option value="Eng">Eng.</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <label className={labelStyles}>First Name</label>
                  <input name="first_name" type="text" value={formData.first_name} onChange={handleChange} className={inputStyles} placeholder="Leon" required />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <label className={labelStyles}>Surname</label>
                  <input name="surname" type="text" value={formData.surname} onChange={handleChange} className={inputStyles} placeholder="Kowalski" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className={labelStyles}>Date of Birth</label>
                  <div className="relative">
                    <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input name="dob" type="date" value={formData.dob} onChange={handleChange} className={`${inputStyles} pl-11`} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelStyles}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className={inputStyles} required>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelStyles}>Pronouns</label>
                  <div className="relative">
                    <UserGroupIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input name="pronouns" type="text" value={formData.pronouns} onChange={handleChange} className={`${inputStyles} pl-11`} placeholder="they/them" />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-black/[0.05] w-full"></div>

            {/* Section 3: Professional Origin */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <BriefcaseIcon className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">Global Node</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className={labelStyles}>Country of Origin</label>
                  <div className="relative">
                    <GlobeEuropeAfricaIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input name="country" type="text" value={formData.country} onChange={handleChange} className={`${inputStyles} pl-11`} placeholder="Neo Tokyo" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelStyles}>Profession</label>
                  <div className="relative">
                    <BriefcaseIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input name="profession" type="text" value={formData.profession} onChange={handleChange} className={`${inputStyles} pl-11`} placeholder="Neural Architect" required />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white rounded-2xl font-black text-sm uppercase tracking-[0.25em] shadow-[0_20px_40px_-12px_rgba(253,59,18,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Initialize Profile"
                )}
              </button>

              <div className="mt-8 text-center text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Recognized Architect?{" "}
                <Link
                  to="/login"
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors ml-2"
                >
                  Recall Identity
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ExternalFooter />
    </div>
  );
};

export default Register;
