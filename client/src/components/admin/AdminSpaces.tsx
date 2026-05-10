import React, { useState, useEffect } from 'react';
import { 
  ServerIcon,
  PlusIcon,
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  EditIcon
} from 'lucide-react';
import type { CodexSpace } from '../../contexts/AIContext';
import { config } from '../../config';

const AdminSpaces: React.FC = () => {
  const [spaces, setSpaces] = useState<CodexSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSpaces = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch spaces');
      const data = await response.json();
      setSpaces(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const handleUpdateSpace = async (spaceId: number, updates: Partial<CodexSpace>) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/admin/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Update failed');
      }
      fetchSpaces();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSpace = async () => {
    const slug = prompt('Enter a unique slug for the new space (e.g. data_science):');
    if (!slug) return;
    const name = prompt('Enter the display name for the new space:');
    if (!name) return;
    const desc = prompt('Enter a description:');
    
    try {
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/admin/spaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          slug,
          name,
          description: desc || "A new specialized workspace.",
          icon: "cube",
          color: "blue",
          is_public: false,
          capacity: 5
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Creation failed');
      }
      fetchSpaces();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredSpaces = spaces.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ServerIcon className="w-5 h-5 text-[var(--accent)]" />
          Space Management
        </h2>
        <button 
          onClick={handleCreateSpace}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-bold shadow hover:bg-[#e0310d] transition-all active:scale-95"
        >
          <PlusIcon className="w-4 h-4" />
          New Space
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3">
          <XCircleIcon className="w-5 h-5" />
          <span className="text-sm font-bold">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircleIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/40 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-black/[0.05] flex items-center justify-between bg-white/30">
          <div className="relative w-full max-w-md">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search by space name or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/50 border border-black/[0.05] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/[0.02]">
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Space</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Slug</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Visibility</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] font-medium">Loading Spaces...</td>
                </tr>
              ) : filteredSpaces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] font-medium">No spaces found.</td>
                </tr>
              ) : filteredSpaces.map((s) => (
                <tr key={s.id} className="hover:bg-white/40 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{s.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">{s.description}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-[#4A4D5E]">
                    {s.slug}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleUpdateSpace(s.id, { is_public: !s.is_public })}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                        s.is_public 
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {s.is_public ? 'PUBLIC' : 'PRIVATE'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleUpdateSpace(s.id, { is_active: !s.is_active })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                        s.is_active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {s.is_active ? <CheckCircleIcon className="w-3 h-3" /> : <XCircleIcon className="w-3 h-3" />}
                      {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      className="p-2 rounded-xl bg-white/50 hover:bg-white text-gray-500 hover:text-[var(--accent)] border border-black/[0.05] transition-all"
                      title="Edit Space"
                      onClick={() => {
                        const newName = prompt("Edit Space Name:", s.name);
                        if(newName) handleUpdateSpace(s.id, { name: newName });
                      }}
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminSpaces;
