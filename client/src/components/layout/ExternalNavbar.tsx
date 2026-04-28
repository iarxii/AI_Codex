import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  FolderKanban,
  Newspaper,
  Menu,
  X,
  Handshake,
} from "lucide-react";
import { motion } from "framer-motion";
import "./ExternalNavbar.css";

const PORTFOLIO_URL = "https://adaptivconceptfl.netlify.app";

const ExternalNavbar: React.FC = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b px-6 py-4"
      style={{
        backgroundColor: `var(--glass-bg)`,
        backdropFilter: "blur(16px)",
        borderBottomColor: `var(--glass-border)`,
      }}
    >
      <div className="container-fluid mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link
          className="flex items-center gap-2 group"
          to="/"
          onClick={() => setIsMenuOpen(false)}
        >
          <img
            // src="/media/adaptiv_media_logo.png"
            src="/media/aicodex_logo_2_transp.png"
            alt="Adaptivconcept FL Logo"
            className="navbar-logo cursor-pointer object-contain rounded-2xl border-2 border-[var(--accent)]"
            title="AdaptivConcept FL"
          />
          <div className="flex items-center">
            <span
              className="text-xl font-bold tracking-tight relative"
              style={{ color: "var(--text-h)" }}
            >
              AdaptivIntelligence
              <div
                style={{
                  position: "absolute",
                  fontSize: "8px",
                  marginTop: "2px",
                  marginRight: "-6px",
                  top: "0",
                  right: "0",
                }}
              >
                ™
              </div>
            </span>
          </div>
        </Link>

        {/* Mobile Toggle */}
        <button
          className="lg:hidden text-[#1A1D2E] p-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {/* Navigation Links */}
        <div
          className={`
          ${isMenuOpen ? "flex" : "hidden"} 
          lg:flex flex-col lg:flex-row items-center absolute lg:static top-full left-0 w-full lg:w-auto 
          transition-colors duration-500
          lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none 
          p-8 lg:p-0 gap-8 lg:gap-10 border-b lg:border-none border-black/[0.06]
          no-scrollbar overflow-x-auto
        `}
          style={{
            backgroundColor:
              isMenuOpen && window.innerWidth < 1024
                ? "rgba(226, 230, 236, 0.98)"
                : "transparent",
          }}
        >
          <ul className="flex flex-col lg:flex-row items-center gap-8 m-0 p-0">
            <li>
              <Link
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-[#FF6600] ${isActive("/") ? "font-bold text-[#FF6600]" : "text-[#4A4D5E]"}`}
                to="/"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home size={18} /> <p className="truncate">Home</p>
              </Link>
            </li>
            <li>
              <a
                href={`${PORTFOLIO_URL}/projects`}
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[#FF6600] text-[#4A4D5E]"
                onClick={() => setIsMenuOpen(false)}
              >
                <FolderKanban size={18} /> <p className="truncate">Projects</p>
              </a>
            </li>
            <li>
              <a
                href={`${PORTFOLIO_URL}/blog`}
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[#FF6600] text-[#4A4D5E]"
                onClick={() => setIsMenuOpen(false)}
              >
                <Newspaper size={18} /> <p className="truncate">Insights</p>
              </a>
            </li>
          </ul>

          <div className="flex flex-col lg:flex-row items-center gap-3">
            <Link
              to="/login"
              onClick={() => setIsMenuOpen(false)}
              className="px-5 py-2.5 rounded-xl border-2 border-black/[0.08] font-medium text-[#1A1D2E] hover:bg-black/[0.04] transition-all flex items-center gap-2"
            >
              <p className="truncate text-sm">Portal Login</p>
            </Link>

            <motion.div
              animate={{
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                display: "flex",
                position: "relative",
              }}
            >
              <a
                href={`${PORTFOLIO_URL}/contact`}
                className="px-8 py-3 rounded-2xl font-black transition-all lg:ml-2 cta-shimmer speech-bubble-cta me-4"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  backgroundColor: "#FF6600",
                  color: "#fff",
                  fontSize: "0.9rem",
                  position: "relative",
                }}
              >
                <div className="shimmer-layer"></div>
                <p className="truncate relative z-10 uppercase tracking-widest">
                  Collaborate
                </p>
                <Handshake size={20} className="relative z-10" />
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default ExternalNavbar;
