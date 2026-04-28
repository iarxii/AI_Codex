import React from 'react';
import { ExternalLink, Mail } from 'lucide-react';

const ExternalFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const PORTFOLIO_URL = "https://adaptivconceptfl.netlify.app";

  return (
    <footer className="w-full py-12 px-6 mt-auto border-t border-black/[0.04]" style={{ 
      backgroundColor: 'rgba(216, 220, 228, 0.4)',
      backdropFilter: 'blur(12px)'
    }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Brand & Copyright */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <h2 className="text-sm font-bold tracking-widest uppercase text-[#1A1D2E]">
            AdaptivConcept FL | <span className="text-[#FF6600]">AI_Codex</span>
          </h2>
          <p className="text-[10px] font-medium text-[#7A7D8E] uppercase tracking-wider">
            © {currentYear} Thabang Mposula | AdaptivConcept FL. All Rights Reserved.
          </p>
        </div>

        {/* Secondary Section: Socials & Links */}
        <div className="flex flex-col items-center md:items-end gap-10">
          {/* Socials */}
          <div className="flex gap-4">
            <a href="https://github.com/iarxii" target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white/50 border border-black/[0.06] text-[#1A1D2E] hover:bg-[#FF6600] hover:text-white transition-all shadow-sm" title="GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
            <a href="https://www.linkedin.com/in/thabang-mposula-iarxii/" target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white/50 border border-black/[0.06] text-[#1A1D2E] hover:bg-[#FF6600] hover:text-white transition-all shadow-sm" title="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href="mailto:contact@adaptivconcept.co.za" className="p-2.5 rounded-full bg-white/50 border border-black/[0.06] text-[#1A1D2E] hover:bg-[#FF6600] hover:text-white transition-all shadow-sm" title="Email">
              <Mail size={18} />
            </a>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end gap-8">
            <div className="flex flex-col gap-3 text-center md:text-right">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF6600]">Ecosystem</span>
              <a href={PORTFOLIO_URL} className="text-xs font-medium text-[#4A4D5E] hover:text-[#1A1D2E] transition-colors flex items-center justify-center md:justify-end gap-1.5">
                Portfolio <ExternalLink size={10} />
              </a>
              <a href={`${PORTFOLIO_URL}/projects`} className="text-xs font-medium text-[#4A4D5E] hover:text-[#1A1D2E] transition-colors flex items-center justify-center md:justify-end gap-1.5">
                Project Board <ExternalLink size={10} />
              </a>
            </div>
            
            <div className="flex flex-col gap-3 text-center md:text-right">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF6600]">Legal</span>
              <a href="#" className="text-xs font-medium text-[#4A4D5E] hover:text-[#1A1D2E] transition-colors">Privacy Policy</a>
              <a href="#" className="text-xs font-medium text-[#4A4D5E] hover:text-[#1A1D2E] transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default ExternalFooter;
