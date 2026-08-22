import React from 'react';
import { XCircleIcon } from 'lucide-react';
import type { Role } from '../../utils/rbac';

interface AdminUser {
  id: number;
  username: string;
  first_name: string | null;
  surname: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface Props {
  user: AdminUser;
  mode: 'view' | 'edit';
  onClose: () => void;
  onUpdate: (userId: number, updates: Partial<AdminUser>) => Promise<void>;
}

export const UserManagementModal: React.FC<Props> = ({ user, mode, onClose, onUpdate }) => {
  const [role, setRole] = React.useState<Role>(user.role);
  const [isActive, setIsActive] = React.useState(user.is_active);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(user.id, { role, is_active: isActive });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-white/40 animate-in fade-in zoom-in">
        <div className="p-6 border-b border-black/[0.05] flex items-center justify-between">
          <h3 className="text-lg font-black text-[var(--text-primary)]">
            {mode === 'edit' ? 'Edit Architect' : 'Architect Details'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <XCircleIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Username</label>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-1">{user.username}</p>
            <p className="text-xs text-[var(--text-muted)]">{user.first_name ?? ''} {user.surname ?? ''}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Joined</label>
            <p className="text-sm font-medium mt-1">{new Date(user.created_at).toLocaleString()}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Role</label>
            {mode === 'edit' ? (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="mt-1 w-full bg-white/50 border border-black/[0.05] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              >
                <option value="user">USER</option>
                <option value="admin">ADMIN</option>
                <option value="super_admin">SUPER ADMIN</option>
              </select>
            ) : (
              <p className="text-sm font-bold mt-1 uppercase">{user.role}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</label>
            {mode === 'edit' ? (
              <label className="mt-1 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                <span className="text-sm font-bold">{isActive ? 'ACTIVE' : 'SUSPENDED'}</span>
              </label>
            ) : (
              <p className="text-sm font-bold mt-1">{user.is_active ? 'ACTIVE' : 'SUSPENDED'}</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-black/[0.02] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-black/[0.05] hover:bg-gray-50 transition-colors">
            Close
          </button>
          {mode === 'edit' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--accent)] text-white hover:bg-[#e0310d] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
