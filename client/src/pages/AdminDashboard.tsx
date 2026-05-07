import React, { useEffect, useState } from 'react';
import { 
  UsersIcon, 
  ShieldCheckIcon, 
  UserMinusIcon, 
  KeyIcon,
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';

interface AdminUser {
  id: number;
  username: str;
  first_name: str | null;
  surname: str | null;
  role: string;
  is_active: bool;
  created_at: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAI();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // RBAC Check
  useEffect(() => {
    if (userProfile && !['admin', 'super_admin'].includes(userProfile.role)) {
      navigate('/chat');
    }
  }, [userProfile, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/v1/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (userId: number, updates: Partial<AdminUser>) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
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
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Are you sure you want to reset this user\'s password?')) return;
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Reset failed');
      const data = await response.json();
      alert(data.message);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.surname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#D8DCE4] p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/chat')}
              className="p-2 rounded-full bg-white/50 hover:bg-white border border-black/[0.05] transition-all"
            >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-[var(--text-primary)] flex items-center gap-3">
                <ShieldCheckIcon className="w-8 h-8 text-[var(--accent)]" />
                Administrative Command Center
              </h1>
              <p className="text-[var(--text-muted)] text-sm font-medium mt-1">
                Role-Based Access Control & User Ecosystem Management
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">Active Session</p>
              <p className="text-sm font-semibold">{userProfile?.first_name} ({userProfile?.role})</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Architects', value: users.length, icon: UsersIcon, color: 'text-blue-600' },
            { label: 'Active Sessions', value: users.filter(u => u.is_active).length, icon: CheckCircleIcon, color: 'text-green-600' },
            { label: 'System Privileges', value: users.filter(u => u.role !== 'user').length, icon: ShieldCheckIcon, color: 'text-[var(--accent)]' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-black mt-1">{stat.value}</p>
                </div>
                <div className={`p-4 rounded-2xl bg-white shadow-inner ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* User Table */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/40 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-black/[0.05] flex items-center justify-between bg-white/30">
            <div className="relative w-full max-w-md">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search by username, name or role..."
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
                  <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Architect</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] font-medium">Initializing Management Data...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] font-medium">No architects found matching your criteria.</td>
                  </tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 border border-white shadow-sm">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{u.username}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{u.first_name} {u.surname}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role}
                        onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                        disabled={u.role === 'super_admin' && userProfile?.role !== 'super_admin'}
                        className="bg-white/50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <option value="user">USER</option>
                        <option value="admin">ADMIN</option>
                        <option value="super_admin">SUPER ADMIN</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleUpdateUser(u.id, { is_active: !u.is_active })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                          u.is_active 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {u.is_active ? <CheckCircleIcon className="w-3 h-3" /> : <XCircleIcon className="w-3 h-3" />}
                        {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-medium text-[var(--text-muted)]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleResetPassword(u.id)}
                          className="p-2 rounded-xl bg-white/50 hover:bg-white text-gray-500 hover:text-[var(--accent)] border border-black/[0.05] transition-all group/btn"
                          title="Reset Password"
                        >
                          <KeyIcon className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 rounded-xl bg-white/50 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-black/[0.05] transition-all"
                          title="Delete User (Locked)"
                          disabled
                        >
                          <UserMinusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
