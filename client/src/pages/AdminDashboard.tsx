import React, { useEffect, useState } from 'react';
import { 
  UsersIcon, 
  ShieldCheckIcon, 
  UserMinusIcon, 
  KeyIcon,
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  EditIcon,
  Trash2Icon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
import AdminSpaces from 'codex_spaces/client/src/components/admin/AdminSpaces';
import { AdminApi, AdminApiError } from '../utils/adminApi';
import { 
  canEditUser, canDeleteUser, canResetPassword, canPromoteTo, roleBadgeColor, type Role 
} from '../utils/rbac';
import { UserManagementModal } from '../components/admin/UserManagementModal';

interface AdminUser {
  id: number;
  username: string;
  first_name: string | null;
  surname: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAI();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'spaces'>('users');
  const [userModal, setUserModal] = useState<{ mode: 'view' | 'edit', user: AdminUser | null }>({ mode: 'view', user: null });

  // RBAC Check
  useEffect(() => {
    if (userProfile && !['admin', 'super_admin'].includes(userProfile.role as string)) {
      navigate('/chat');
    }
  }, [userProfile, navigate]);

  const fetchUsers = async () => {
    try {
      const data = await AdminApi.listUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (userId: number, updates: Partial<AdminUser>) => {
    try {
      await AdminApi.updateUser(userId, updates);
      await fetchUsers();
    } catch (err: any) {
      if (err instanceof AdminApiError) {
        alert(err.detail);
      } else {
        alert(err.message);
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await AdminApi.deleteUser(userId);
      await fetchUsers();
    } catch (err: any) {
      if (err instanceof AdminApiError) {
        alert(err.detail);
      } else {
        alert(err.message);
      }
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Reset this user\'s password to a temporary one?')) return;
    try {
      const data = await AdminApi.resetPassword(userId);
      alert(data.message);
    } catch (err: any) {
      if (err instanceof AdminApiError) {
        alert(err.detail);
      } else {
        alert(err.message);
      }
    }
  };

  const openUserModal = (mode: 'view' | 'edit', user: AdminUser) => {
    setUserModal({ mode, user });
  };

  const closeUserModal = () => {
    setUserModal({ mode: 'view', user: null });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.surname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Actor for RBAC
  const actor = { id: userProfile?.id ?? null, role: (userProfile?.role as Role) || 'user' };

  // If loading user profile, show skeleton
  if (!userProfile) return null;

  // Final check for non-admin entry
  if (!['admin', 'super_admin'].includes(userProfile.role as string)) {
    return (
      <div className="min-h-screen bg-[#D8DCE4] flex items-center justify-center p-8">
        <div className="bg-white/80 backdrop-blur-2xl p-12 rounded-[40px] border border-white/40 shadow-2xl text-center max-w-md animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-100 shadow-inner">
            <XCircleIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-[#1A1D2E] mb-2 tracking-tight">Access Denied</h2>
          <p className="text-[#4A4D5E] text-sm font-medium leading-relaxed mb-8">
            You have reached the Administrative Command Center. This sector is restricted to 
            authorized architects only.
          </p>
          <button 
            onClick={() => navigate('/chat')}
            className="w-full py-4 bg-[#1A1D2E] text-white rounded-2xl font-bold shadow-xl hover:bg-black transition-all active:scale-95"
          >
            Return to Codex
          </button>
        </div>
      </div>
    );
  }

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
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 animate-shake">
            <XCircleIcon className="w-5 h-5" />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        )}

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

        {/* Tab Selection */}
        <div className="flex items-center gap-2 mb-6 bg-white/40 p-1.5 rounded-2xl w-fit border border-black/[0.05]">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-white shadow-sm text-[var(--accent)] border border-black/[0.05]'
                : 'text-[#4A4D5E] hover:bg-black/5 hover:text-[#1A1D2E]'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('spaces')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'spaces'
                ? 'bg-white shadow-sm text-[var(--accent)] border border-black/[0.05]'
                : 'text-[#4A4D5E] hover:bg-black/5 hover:text-[#1A1D2E]'
            }`}
          >
            Space Management
          </button>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'users' ? (
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
                ) : filteredUsers.map((u) => {
                  const target = { id: u.id, role: u.role };
                  const canEdit = canEditUser(actor, target);
                  const canDelete = canDeleteUser(actor, target);
                  const canReset = canResetPassword(actor, target);
                  return (
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
                          onChange={(e) => canPromoteTo(actor, e.target.value as Role) && handleUpdateUser(u.id, { role: e.target.value })}
                          disabled={!canPromoteTo(actor, u.role) || (u.role === 'super_admin' && actor.role !== 'super_admin')}
                          className={`bg-white/50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all ${!canPromoteTo(actor, u.role) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                          <option value="super_admin">SUPER ADMIN</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => canEdit && handleUpdateUser(u.id, { is_active: !u.is_active })}
                          disabled={!canEdit}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${!canEdit ? 'opacity-50 cursor-not-allowed' : u.is_active 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
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
                            onClick={() => openUserModal('view', u)}
                            className="p-2 rounded-xl bg-white/50 hover:bg-white text-gray-500 hover:text-[var(--accent)] border border-black/[0.05] transition-all"
                            title="View Details"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          {canReset && (
                            <button 
                              onClick={() => handleResetPassword(u.id)}
                              className="p-2 rounded-xl bg-white/50 hover:bg-white text-gray-500 hover:text-[var(--accent)] border border-black/[0.05] transition-all"
                              title="Reset Password"
                            >
                              <KeyIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2 rounded-xl bg-white/50 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-black/[0.05] transition-all"
                              title="Delete User"
                            >
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          )}
                          {!canDelete && (
                            <button 
                              className="p-2 rounded-xl bg-white/50 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-black/[0.05] transition-all"
                              title="Delete User (Requires super_admin)"
                              disabled
                            >
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {userModal.user && <UserManagementModal user={userModal.user} mode={userModal.mode} onClose={closeUserModal} onUpdate={handleUpdateUser} />}
        </div>
        ) : (
          <AdminSpaces />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
