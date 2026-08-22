// rbac.ts — Frontend RBAC helpers mirroring backend/api/admin.py
// Keep in sync with docs/RBAC.md and backend checks

export type Role = 'user' | 'admin' | 'super_admin';

export interface Actor {
  id?: number | null;
  role: Role;
}

export interface TargetUser {
  id: number;
  role: Role;
}

export function canModifySuperAdmin(actor: Actor, targetRole: Role): boolean {
  if (targetRole === 'super_admin' && actor.role !== 'super_admin') return false;
  return true;
}

export function canPromoteTo(actor: Actor, newRole: Role): boolean {
  if (newRole === 'admin' || newRole === 'super_admin') {
    return actor.role === 'super_admin';
  }
  return true; // demoting to 'user' allowed for admin
}

export function canEditUser(actor: Actor, target: TargetUser): boolean {
  if (!canModifySuperAdmin(actor, target.role)) return false;
  return actor.role === 'admin' || actor.role === 'super_admin';
}

export function canDeleteUser(actor: Actor, target: TargetUser): boolean {
  if (actor.role !== 'super_admin') return false;
  if (actor.id != null && actor.id === target.id) return false; // no self-delete
  return true;
}

export function canResetPassword(actor: Actor, target: TargetUser): boolean {
  return canModifySuperAdmin(actor, target.role);
}

export function canCreateSpace(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'super_admin';
}

export function canUpdateSpace(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'super_admin';
}

export function canDeleteSpace(actor: Actor): boolean {
  return actor.role === 'super_admin';
}

export function canManageSpaceAccess(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'super_admin';
}

export function roleBadgeColor(role: Role): string {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'admin': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
