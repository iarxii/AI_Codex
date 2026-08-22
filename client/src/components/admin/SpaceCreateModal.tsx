import React, { useState } from 'react';
import { XIcon } from 'lucide-react';

export interface SpaceCreatePayload {
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  harness: string | null;
  is_public: boolean;
  capacity: number;
  required_role: string;
  config_json: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: SpaceCreatePayload) => Promise<void>;
}

const HARNESS_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'None (generic)' },
  { value: 'fintrader', label: 'FinTrader (trading / market debate)' },
  { value: 'gemma-sandbox', label: 'Gemma Sandbox (code lab, MTP)' },
  { value: 'microsoft-agent', label: 'Microsoft Agent Lab (Go sidecar :5005)' },
  { value: 'spirit-book-chat', label: 'SpiritBook (chat helper)' },
];

const ICON_PRESETS = ['cube', '/media/brand-icons/gemma.svg', '/media/brand-icons/microsoft.svg', '/media/aicodex-spirit-bird-white.png', 'SparklesIcon'];

export const SpaceCreateModal: React.FC<Props> = ({ open, onClose, onCreate }) => {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('cube');
  const [color, setColor] = useState('#6366f1');
  const [harness, setHarness] = useState<string | ''>('');
  const [isPublic, setIsPublic] = useState(false);
  const [capacity, setCapacity] = useState(5);
  const [requiredRole, setRequiredRole] = useState('user');
  const [configJson, setConfigJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // client-side slug validation mirrors backend: ^[a-z0-9-]{3,50}$
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,50}$/.test(normalized)) {
      setError('Slug must be 3-50 chars, lowercase alphanumeric + hyphens');
      return;
    }
    if (!name.trim() || !description.trim()) {
      setError('Name and description are required');
      return;
    }
    if (configJson.trim()) {
      try { JSON.parse(configJson); } catch (err: any) {
        setError(`config_json invalid JSON: ${err.message}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onCreate({
        slug: normalized,
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim() || null,
        color: color.trim() || null,
        harness: harness || null,
        is_public: isPublic,
        capacity: Number(capacity),
        required_role: requiredRole,
        config_json: configJson.trim() || null,
      });
      // reset on success
      setSlug(''); setName(''); setDescription(''); setConfigJson('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl border border-white/40">
        <div className="sticky top-0 bg-white/80 backdrop-blur-xl p-6 border-b border-black/[0.06] flex items-center justify-between rounded-t-[28px]">
          <div>
            <h2 className="text-lg font-black text-[#1A1D2E]">Create CodexSpace</h2>
            <p className="text-xs text-[#7A7D8E] font-medium">Handled by <code className="bg-black/5 px-1.5 py-0.5 rounded">codex_spaces/backend/space_scaffold.py</code> — DB + filesystem + registry + GCS</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-black/5">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Slug *</span>
              <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. data-science-lab" className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20" required />
              <span className="text-[10px] text-[#7A7D8E]">3-50 lowercase, hyphens allowed. Creates <code>data/spaces/{'{slug}'}/</code></span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Harness *</span>
              <select value={harness} onChange={e => setHarness(e.target.value)} className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm">
                {HARNESS_OPTIONS.map(o => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
              </select>
              <span className="text-[10px] text-[#7A7D8E]">Sets <code>config_json.harness</code> → client <code>spaceHarnessRegistry.tsx</code></span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Display Name *</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome Lab" className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20" required />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Description *</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this space for?" className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20" required />
          </label>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Icon</span>
              <select value={icon} onChange={e => setIcon(e.target.value)} className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm">
                {ICON_PRESETS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="custom icon path" className="mt-1 px-3 py-2 bg-white border border-black/[0.06] rounded-xl text-xs" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Color</span>
              <div className="flex gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-10 rounded-xl border border-black/[0.06] p-1 bg-white" />
                <input value={color} onChange={e => setColor(e.target.value)} className="flex-1 px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm font-mono" />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Capacity</span>
              <input type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 bg-[#F8F9FB] border border-black/[0.06] rounded-xl px-3 py-2.5">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" />
              <span className="text-sm font-bold text-[#1A1D2E]">Public</span>
              <span className="text-xs text-[#7A7D8E]">({isPublic ? 'Anyone can access' : 'Private, needs grant'})</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Required Role</span>
              <select value={requiredRole} onChange={e => setRequiredRole(e.target.value)} className="px-3 py-2.5 bg-[#F8F9FB] border border-black/[0.06] rounded-xl text-sm">
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#7A7D8E]">Advanced config_json (JSON object, optional)</span>
            <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={4} placeholder='e.g. {"is_gpu_enabled": true, "constraints": {"max_rounds": 3}}' className="px-3 py-2.5 bg-[#0F172A] text-[#E2E8F0] border border-black/10 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20" />
            <span className="text-[10px] text-[#7A7D8E]">Merged with harness defaults server-side via <code>build_config_json()</code>. Leave empty to use harness defaults.</span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl p-6 border-t border-black/[0.06] flex justify-end gap-3 rounded-b-[28px]">
          <button type="button" onClick={onClose} disabled={submitting} className="px-5 py-2.5 rounded-xl bg-white border border-black/[0.06] text-sm font-bold hover:bg-black/5 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-[#fd3b12] text-white text-sm font-bold shadow hover:bg-[#e0310d] disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Space'}
          </button>
        </div>
      </form>
    </div>
  );
};
