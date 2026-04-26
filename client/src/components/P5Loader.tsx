import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

const P5Loader: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(120, 24).parent(containerRef.current!);
        p.frameRate(60);
      };

      p.draw = () => {
        p.clear(0, 0, 0, 0);
        p.noFill();
        
        // Draw 3 wave strands
        for (let i = 0; i < 3; i++) {
          const alpha = 255 - i * 60;
          p.stroke(255, 102, 0, alpha); // AdaptivOrange
          p.strokeWeight(1.5 - i * 0.3);
          
          p.beginShape();
          for (let x = 0; x < p.width; x++) {
            // Wave equation: y = amplitude * sin(frequency * x + phase)
            // Phase increases with frameCount to animate left-to-right
            const frequency = 0.05;
            const amplitude = 6 - i * 1.5;
            const phase = -p.frameCount * 0.15 + i * 0.8;
            const y = p.height / 2 + p.sin(x * frequency + phase) * amplitude;
            p.vertex(x, y);
          }
          p.endShape();
        }
      };
    };

    const p5Instance = new p5(sketch);
    return () => p5Instance.remove();
  }, []);

  return <div ref={containerRef} className="inline-flex items-center justify-center opacity-80" />;
};

export default P5Loader;
