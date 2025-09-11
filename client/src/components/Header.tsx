import React, { useState } from 'react';
import logo from '../assets/gp_healthmedagentix_logo.jpeg'; 

interface HeaderProps {
  onOpenSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-md p-4 flex items-center justify-between relative">
      {/* Hamburger for sidebar */}
      <button
        onClick={onOpenSidebar}
        className="md:hidden p-2 rounded-md hover:bg-gray-200"
        aria-label="Open sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#02396e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>
      <img src={logo} style={{ maxWidth: "200px", height: "auto", borderRadius: "12px" }} alt="logo" />
      {/* <h1 className="text-md font-bold text-gray-800">GP HealthMedAgentix</h1> */}
      {/* Profile/Menu button */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="p-2 rounded-full bg-[#00509d] hover:bg-[#02396e] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open menu" 
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.797.657 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Profile</button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Documents</button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Settings</button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Options</button>
            <div className="border-t my-1" />
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Login</button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600" onClick={() => setMenuOpen(false)}>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
