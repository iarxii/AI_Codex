import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { Brain, Bot } from 'lucide-react';

interface AgentPulseProps {
  mode?: 'thinking' | 'idle';
  className?: string;
  showText?: boolean;
}

const AgentPulse: React.FC<AgentPulseProps> = ({ mode = 'thinking', className = "", showText = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      p.setup = () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        p.createCanvas(100, 24).parent(containerRef.current!);
        p.frameRate(60);
      };

      p.draw = () => {
        p.clear(0, 0, 0, 0);
        p.noFill();
        
        
        const isThinking = mode === 'thinking';
        
        // Dynamic animation constants based on mode
        const speed = isThinking ? 0.15 : 0.04;          // Slower when idle
        const frequency = isThinking ? 0.06 : 0.025;      // Higher wavelength (lower freq) when idle
        const baseAmplitude = isThinking ? 6 : 4;         // Subtler when idle
        
        // Draw 3 wave strands
        for (let i = 0; i < 3; i++) {
          const alpha = isThinking ? (255 - i * 60) : (180 - i * 40);
          const color = isThinking ? [255, 102, 0] : [100, 116, 139]; // Orange for thinking, Slate for idle
          
          p.stroke(color[0], color[1], color[2], alpha);
          p.strokeWeight(isThinking ? (1.5 - i * 0.3) : (1.2 - i * 0.3));
          
          p.beginShape();
          for (let x = 0; x < p.width; x++) {
            // Wave equation: y = amplitude * sin(frequency * x + phase)
            const amplitude = baseAmplitude - i * 1.5;
            // Floatiness: add a second slower sine for vertical drift
            const drift = isThinking ? 0 : p.sin(p.frameCount * 0.02 + i) * 2;
            const phase = -p.frameCount * speed + i * 0.8;
            
            const y = (p.height / 2 + drift) + p.sin(x * frequency + phase) * amplitude;
            p.vertex(x, y);
          }
          p.endShape();
        }
      };
    };

    const p5Instance = new p5(sketch);
    return () => p5Instance.remove();
  }, [mode]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-shrink-0">
        {mode === 'thinking' ? (
          <Brain className="w-4 h-4 text-[#FF6600]" />
        ) : (
          <Bot className="w-4 h-4 text-slate-500 opacity-80" />
        )}
      </div>
      <div ref={containerRef} className="opacity-80" />
      {showText && (
        <span className={`text-[10px] font-bold uppercase tracking-widest ${
          mode === 'thinking' ? 'text-[#FF6600]/70' : 'text-slate-500/60'
        }`}>
          {mode === 'thinking' ? 'Synthesizing' : 'Awaiting Input'}
        </span>
      )}
    </div>
  );
};

export default AgentPulse;
