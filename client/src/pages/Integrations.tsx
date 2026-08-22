import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ServerIcon,
  GitBranchIcon,
  MailIcon,
  MessageSquareIcon,
  PlugIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  Loader2,
  SettingsIcon,
  UnplugIcon,
  ShieldIcon,
  GlobeIcon,
  PlusIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import { useAI } from '../contexts/AIContext';
import { config } from '../config';
import { getValidToken, clearAuthSession } from '../utils/authToken';

interface Provider {
  id: string;
  name: string;
  slug: string;
  icon_url?: string;
  scopes: string[];
  oauth_authorize_url?: string;
  oauth_token_url?: string;
}

interface UserConnection {
  provider: string;
  status: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
}

interface SpaceConnection {
  connection_id: number;
  enabled: boolean;
  config: string;
  created_at: string;
}

const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const { activeSpace } = useAI();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [spaceConnections, setSpaceConnections] = useState<SpaceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oauthPopup, setOauthPopup] = useState<Window | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchConnections();
    if (activeSpace) fetchSpaceConnections(activeSpace.id);
  }, [activeSpace]);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const token = getValidToken();
    if (!token) {
      clearAuthSession();
      navigate('/login');
      throw new Error('Session expired');
    }
    const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      clearAuthSession();
      navigate('/login');
    }
    return res;
  };

  const fetchProviders = async () => {
    try {
      const res = await apiFetch('/integrations/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await apiFetch('/integrations/my-connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error('Failed to fetch connections:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpaceConnections = async (spaceId: number) => {
    try {
      const res = await apiFetch(`/integrations/spaces/${spaceId}/connections`);
      if (res.ok) {
        const data = await res.json();
        setSpaceConnections(data);
      }
    } catch (e) {
      console.error('Failed to fetch space connections:', e);
    }
  };

  const handleConnect = async (provider: Provider) => {
    setConnecting(provider.slug);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;
      const res = await apiFetch(`/integrations/connect/${provider.slug}`, {
        method: 'POST',
        body: JSON.stringify({ redirect_uri: redirectUri }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to initiate connection');
      }
      const { authorization_url } = await res.json();
      
      // Open OAuth popup
      const popup = window.open(
        authorization_url,
        'oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      setOauthPopup(popup);
      
      // Poll for completion
      pollForCompletion(provider.slug);
    } catch (e: any) {
      setError(e.message || 'Failed to initiate connection');
      setConnecting(null);
    }
  };

  const pollForCompletion = (providerSlug: string) => {
    const checkInterval = setInterval(async () => {
      if (!oauthPopup || oauthPopup.closed) {
        clearInterval(checkInterval);
        setOauthPopup(null);
        if (connecting === providerSlug) setConnecting(null);
        return;
      }
      
      // Check if we have a connection for this provider
      try {
        const res = await apiFetch('/integrations/my-connections');
        if (res.ok) {
          const data = await res.json();
          const conn = data.find((c: UserConnection) => c.provider === providerSlug);
          if (conn && conn.status === 'active') {
            clearInterval(checkInterval);
            setOauthPopup(null);
            setConnecting(null);
            setSuccess(`${providerSlug} connected successfully!`);
            fetchConnections();
            setTimeout(() => setSuccess(null), 5000);
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 2000);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      if (oauthPopup && !oauthPopup.closed) {
        oauthPopup.close();
      }
      setOauthPopup(null);
      if (connecting === providerSlug) setConnecting(null);
    }, 300000);
  };

  const handleDisconnect = async (providerSlug: string) => {
    if (!confirm(`Disconnect ${providerSlug}? This will revoke access.`)) return;
    setError(null);
    try {
      // Note: backend needs a delete endpoint; for now show not implemented
      setError('Disconnect not yet implemented in backend');
    } catch (e: any) {
      setError(e.message || 'Failed to disconnect');
    }
  };

  const handleBindToSpace = async (connectionId: number) => {
    if (!activeSpace) return;
    setError(null);
    try {
      const res = await apiFetch(`/integrations/spaces/${activeSpace.id}/bind-connection`, {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to bind connection');
      }
      setSuccess('Connection enabled in workspace');
      fetchSpaceConnections(activeSpace.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to bind connection');
    }
  };

  const getProviderIcon = (slug: string, iconUrl?: string) => {
    if (iconUrl) return <img src={iconUrl} alt={slug} className="w-8 h-8 rounded-lg" />;
    switch (slug) {
      case 'google': return <MailIcon className="w-8 h-8 text-blue-600" />;
      case 'github': return <GitBranchIcon className="w-8 h-8 text-gray-800" />;
      case 'slack': return <MessageSquareIcon className="w-8 h-8 text-purple-600" />;
      default: return <PlugIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  const getConnectionStatus = (providerSlug: string) => {
    const conn = connections.find(c => c.provider === providerSlug);
    return conn;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#D8DCE4] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)]" />
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
                <ServerIcon className="w-8 h-8 text-[var(--accent)]" />
                Integrations
              </h1>
              <p className="text-[var(--text-muted)] text-sm font-medium mt-1">
                Connect external services and enable them in your workspaces
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {activeSpace && (
              <span className="px-3 py-1.5 bg-white/50 border border-black/[0.05] rounded-xl text-sm font-medium">
                Active: {activeSpace.name}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 animate-shake">
            <AlertCircleIcon className="w-5 h-5" />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-700 rounded-2xl flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span className="text-sm font-bold">{success}</span>
          </div>
        )}

        {/* Available Providers */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/40 shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-black/[0.05] bg-white/30">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-[var(--accent)]" />
              Available Services
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => {
              const connection = getConnectionStatus(provider.slug);
              const isConnected = connection?.status === 'active';
              const isConnecting = connecting === provider.slug;
              
              return (
                <div key={provider.slug} className="bg-white/50 border border-black/[0.05] rounded-2xl p-6 transition-all hover:border-[var(--accent)]/30">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-tr from-gray-100 to-gray-200 rounded-xl">
                      {getProviderIcon(provider.slug, provider.icon_url)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--text-primary)]">{provider.name}</h3>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        {provider.scopes.length} scopes available
                      </p>
                      {isConnected && (
                        <div className="mt-2 flex items-center gap-2 text-green-600">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Connected</span>
                        </div>
                      )}
                      {isConnecting && (
                        <div className="mt-2 flex items-center gap-2 text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">Waiting for authorization...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-black/[0.05] flex items-center justify-between">
                    <div className="text-xs text-[var(--text-muted)]">
                      {provider.scopes.slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium mr-1">
                          {s}
                        </span>
                      ))}
                      {provider.scopes.length > 3 && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          +{provider.scopes.length - 3} more
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleConnect(provider)}
                      disabled={isConnected || isConnecting}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        isConnected
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-[var(--accent)] text-white hover:bg-[#e0310d]'
                      }`}
                    >
                      {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>
                </div>
              );
            })}
            
            {providers.length === 0 && (
              <div className="col-span-full text-center py-12 text-[var(--text-muted)]">
                <PlugIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No integration providers configured</p>
              </div>
            )}
          </div>
        </div>

        {/* Your Connections */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/40 shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-black/[0.05] bg-white/30">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <PlugIcon className="w-5 h-5 text-[var(--accent)]" />
              Your Connections
            </h2>
          </div>
          <div className="p-6">
            {connections.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <UnplugIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No connections yet</p>
                <p className="text-sm mt-1">Connect a service above to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((conn) => (
                  <div key={conn.provider} className="flex items-center justify-between p-4 bg-white/50 border border-black/[0.05] rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${conn.status === 'active' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {conn.status === 'active' ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-[var(--text-primary)] capitalize">{conn.provider}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {conn.scopes.length} scopes • {conn.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSpace && (
                        <button
                          onClick={() => handleBindToSpace(0)} // Would need connection ID
                          className="px-3 py-1.5 bg-white/50 hover:bg-white text-[var(--text-primary)] border border-black/[0.05] rounded-xl text-sm font-medium transition-all"
                        >
                          <ShieldIcon className="w-4 h-4 mr-1" />
                          Enable in Workspace
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(conn.provider)}
                        className="px-3 py-1.5 bg-white/50 hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium transition-all"
                      >
                        <UnplugIcon className="w-4 h-4 mr-1" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workspace Integrations */}
        {activeSpace && (
          <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/40 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-black/[0.05] bg-white/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldIcon className="w-5 h-5 text-[var(--accent)]" />
                Enabled in "{activeSpace.name}"
              </h2>
            </div>
            <div className="p-6">
              {spaceConnections.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <GlobeIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No integrations enabled in this workspace</p>
                  <p className="text-sm mt-1">Enable connections from above to use them here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {spaceConnections.map((sc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/50 border border-black/[0.05] rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${sc.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {sc.enabled ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircleIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-primary)]">Connection #{sc.connection_id}</p>
                          <p className="text-sm text-[var(--text-muted)]">
                            {sc.enabled ? 'Enabled' : 'Disabled'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 bg-white/50 hover:bg-white text-[var(--text-primary)] border border-black/[0.05] rounded-xl text-sm font-medium transition-all">
                          <SettingsIcon className="w-4 h-4 mr-1" />
                          Configure
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Integrations;