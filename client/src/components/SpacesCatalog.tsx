import React, { useEffect, useState } from 'react';
import { useAI } from '../contexts/AIContext';
import type { CodexSpace } from '../contexts/AIContext';
import SpaceCard from './SpaceCard';
import { config } from '../config';

interface SpacesCatalogProps {
    onSpaceSelected: () => void;
}

const SpacesCatalog: React.FC<SpacesCatalogProps> = ({ onSpaceSelected }) => {
    const { setActiveSpace, setViewSpacesCatalog } = useAI();
    const [spaces, setSpaces] = useState<CodexSpace[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSpaces();
    }, []);

    const fetchSpaces = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSpaces(data);
            }
        } catch (e) {
            console.error("Failed to fetch spaces catalog", e);
        } finally {
            setLoading(false);
        }
    }

    const handleEnterSpace = (space: CodexSpace) => {
        setActiveSpace(space);
        setViewSpacesCatalog(false);
        onSpaceSelected();
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="max-w-5xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4 tracking-tight">
                        <span className="text-[var(--accent)]">Codex</span> Spaces
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)]">Discover and enter specialized agentic environments.</p>
                </div>
                
                {loading ? (
                    <div className="text-center py-20 text-[var(--text-secondary)] animate-pulse font-semibold uppercase tracking-widest text-sm">
                        Loading Spaces...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {spaces.map(space => (
                            <SpaceCard key={space.id} space={space} onEnter={handleEnterSpace} />
                        ))}
                        {spaces.length === 0 && (
                            <div className="col-span-full text-center py-10 text-[var(--text-muted)]">
                                No spaces available. Please contact your administrator.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpacesCatalog;
