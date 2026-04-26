import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { useAI } from '../contexts/AIContext';

interface P5BackgroundProps {
  isDynamic?: boolean;
}

const P5Background: React.FC<P5BackgroundProps> = ({ isDynamic: propIsDynamic }) => {
  const { visualSettings } = useAI();
  const isDynamic = propIsDynamic ?? visualSettings.isDynamic;
  const { showTraces, showScanlines, showGlitches, showGrain, showVideo, showWaves, showNeuralStrings, stringColor } = visualSettings;
  
  // PENDING: isDynamic prop will eventually be wired to user preferences / low-power mode toggle.
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate =1.3; // Atmospheric slow-mo
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let traces: Trace[] = [];
      let curves: Curve[] = [];
      let glitches: Glitch[] = [];
      let grainTexture: p5.Graphics;
      const GRID_SIZE = 40;
      const MAX_TRACES = 30; // Increased density for dynamic activity
      const MAX_CURVES = 8;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(containerRef.current!);
        p.frameRate(30); // Performance optimization
        
        for (let i = 0; i < MAX_TRACES; i++) {
          traces.push(new Trace(p));
        }
        for (let i = 0; i < MAX_CURVES; i++) {
          curves.push(new Curve(p));
        }
        for (let i = 0; i < 3; i++) {
          glitches.push(new Glitch(p));
        }

        // Pre-generate a high-density grain texture
        grainTexture = p.createGraphics(400, 400);
        grainTexture.loadPixels();
        for (let i = 0; i < grainTexture.width * grainTexture.height; i++) {
          const val = p.random(255);
          const alpha = p.random(10, 30);
          const index = i * 4;
          grainTexture.pixels[index] = val;
          grainTexture.pixels[index + 1] = val;
          grainTexture.pixels[index + 2] = val;
          grainTexture.pixels[index + 3] = alpha;
        }
        grainTexture.updatePixels();
      };

      p.draw = () => {
        // Clear with slight alpha for trails
        p.clear(0,0,0,0);
        
        if (showTraces) {
          traces.forEach(t => {
            if (isDynamic) t.update();
            t.display();
          });
        }

        if (showNeuralStrings) {
          curves.forEach(c => {
            if (isDynamic) c.update();
            c.display();
          });
        }

        if (showGlitches && isDynamic) {
          glitches.forEach(g => {
            g.update();
            g.display();
          });
        }

        // Grain Overlay
        if (showGrain && grainTexture) {
          const xOff = isDynamic ? p.random(-100, 100) : 0;
          const yOff = isDynamic ? p.random(-100, 100) : 0;
          for (let x = -400; x < p.width; x += 400) {
            for (let y = -400; y < p.height; y += 400) {
              p.image(grainTexture, x + xOff, y + yOff);
            }
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      class Trace {
        p: p5;
        x!: number;
        y!: number;
        prevX!: number;
        prevY!: number;
        dir!: p5.Vector;
        history!: {x: number, y: number}[];
        life!: number;
        maxLife!: number;
        speed!: number;
        color!: {r: number, g: number, b: number};

        constructor(p: p5) {
          this.p = p;
          this.init();
        }

        init() {
          this.x = Math.floor(this.p.random(this.p.width) / GRID_SIZE) * GRID_SIZE;
          this.y = Math.floor(this.p.random(this.p.height) / GRID_SIZE) * GRID_SIZE;
          this.prevX = this.x;
          this.prevY = this.y;
          this.dir = this.getRandomDir();
          this.history = [];
          this.maxLife = this.p.random(100, 300); // Longer life to account for slower speed
          this.life = this.maxLife;
          this.speed = GRID_SIZE / 8; // Default speed

          // Split colors: 2/3 White (faster), 1/3 Orange (standard)
          const rand = this.p.random();
          if (rand < 0.66) {
            this.color = { r: 255, g: 255, b: 255 }; // White
            this.speed = GRID_SIZE / 5; // Faster white traces for dynamic feel
          } else {
            this.color = { r: 255, g: 102, b: 0 }; // Orange
            this.speed = GRID_SIZE / 8; // Standard speed
          }
          /* 
          else {
            this.color = { r: 40, g: 44, b: 52 }; // Deep Coal (Muted for now)
          } 
          */
        }

        getRandomDir() {
          const dirs = [
            this.p.createVector(1, 0),
            this.p.createVector(-1, 0),
            this.p.createVector(0, 1),
            this.p.createVector(0, -1)
          ];
          return dirs[Math.floor(this.p.random(dirs.length))];
        }

        update() {
          this.history.push({x: this.x, y: this.y});
          // Keep a longer tail to look more like a circuit trace
          if (this.history.length > 40) this.history.shift();

          this.prevX = this.x;
          this.prevY = this.y;
          
          this.x += this.dir.x * this.speed;
          this.y += this.dir.y * this.speed;

          // Only turn exactly on grid intersections
          if (this.x % GRID_SIZE === 0 && this.y % GRID_SIZE === 0) {
            // 25% chance to turn at an intersection
            if (this.p.random() < 0.25) {
              const newDir = this.getRandomDir();
              // Prevent 180-degree turnarounds
              if (newDir.x !== -this.dir.x || newDir.y !== -this.dir.y) {
                this.dir = newDir;
              }
            }
          }

          this.life--;
          if (this.life <= 0 || this.x < 0 || this.x > this.p.width || this.y < 0 || this.y > this.p.height) {
            this.init();
          }
        }

        display() {
          this.p.noFill();
          this.p.strokeWeight(2.5);
          
          // Calculate lifecycle fade (spawn/die transitions)
          let fadeMultiplier = 1;
          const FADE_DUR = 30; // Frames to fade in/out
          if (this.maxLife - this.life < FADE_DUR) {
            fadeMultiplier = this.p.map(this.maxLife - this.life, 0, FADE_DUR, 0, 1);
          } else if (this.life < FADE_DUR) {
            fadeMultiplier = this.p.map(this.life, 0, FADE_DUR, 0, 1);
          }

          // Draw history segments with feathering (older points are more transparent)
          for (let i = 0; i < this.history.length - 1; i++) {
            const pos = this.history[i];
            const nextPos = this.history[i + 1];
            const segmentAlpha = this.p.map(i, 0, this.history.length, 0, 220) * fadeMultiplier;
            this.p.stroke(this.color.r, this.color.g, this.color.b, segmentAlpha);
            this.p.line(pos.x, pos.y, nextPos.x, nextPos.y);
          }

          // Draw the final segment from history to current head
          if (this.history.length > 0) {
            const lastPos = this.history[this.history.length - 1];
            this.p.stroke(this.color.r, this.color.g, this.color.b, 220 * fadeMultiplier);
            this.p.line(lastPos.x, lastPos.y, this.x, this.y);
          }

          // Head glow
          this.p.noStroke();
          this.p.fill(this.color.r, this.color.g, this.color.b, 255 * fadeMultiplier);
          this.p.circle(this.x, this.y, 6);
        }
      }

      class Glitch {
        p: p5;
        x: number = 0;
        y: number = 0;
        w: number = 0;
        h: number = 0;
        active: boolean = false;
        timer: number = 0;
        color: {r: number, g: number, b: number} = {r: 255, g: 255, b: 255};

        constructor(p: p5) {
          this.p = p;
        }

        update() {
          if (!this.active) {
            // Random chance to trigger a glitch slice
            if (this.p.random() < 0.005) {
              this.active = true;
              this.timer = Math.floor(this.p.random(2, 8));
              this.y = this.p.random(this.p.height);
              this.x = 0;
              this.w = this.p.width;
              this.h = this.p.random(2, 40);
              this.color = this.p.random() > 0.7 
                ? { r: 255, g: 102, b: 0 } 
                : { r: 255, g: 255, b: 255 };
            }
          } else {
            this.timer--;
            if (this.timer <= 0) this.active = false;
          }
        }

        display() {
          if (this.active && isDynamic) {
            this.p.noStroke();
            this.p.fill(this.color.r, this.color.g, this.color.b, this.p.random(20, 80));
            
            // Draw a main slice
            this.p.rect(this.x, this.y, this.w, this.h);
            
            // Draw some tiny "digital noise" blocks nearby
            if (this.p.random() > 0.5) {
              for(let i=0; i<5; i++) {
                this.p.fill(this.color.r, this.color.g, this.color.b, this.p.random(50, 150));
                this.p.rect(
                  this.p.random(this.p.width), 
                  this.y + this.p.random(-50, 50), 
                  this.p.random(5, 50), 
                  this.p.random(1, 4)
                );
              }
            }
          }
        }
      }

      class Curve {
        p: p5;
        points: p5.Vector[];
        seed: number;

        constructor(p: p5) {
          this.p = p;
          this.seed = this.p.random(1000);
          this.points = [];
          for (let i = 0; i < 5; i++) {
            this.points.push(this.p.createVector(this.p.random(this.p.width), this.p.random(this.p.height)));
          }
        }

        update() {
          this.points.forEach((pt, i) => {
            pt.x += (this.p.noise(this.seed + i, this.p.frameCount * 0.005) - 0.5) * 2;
            pt.y += (this.p.noise(this.seed + i + 100, this.p.frameCount * 0.005) - 0.5) * 2;
          });
        }

        display() {
          this.p.noFill();
          
          let strokeCol;
          if (stringColor === 'orange') {
            strokeCol = this.p.color(255, 102, 0, 100); // AdaptivOrange
          } else if (stringColor === 'white') {
            strokeCol = this.p.color(255, 255, 255, 150); // Sharp White
          } else {
            strokeCol = this.p.color(26, 29, 46, 120); // Dark/Coal
          }

          this.p.stroke(strokeCol);
          this.p.strokeWeight(1.5);
          this.p.beginShape();
          this.points.forEach(pt => this.p.vertex(pt.x, pt.y));
          this.p.endShape();
        }
      }
    };

    const p5Instance = new p5(sketch);
    return () => p5Instance.remove();
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#E2E8F0]">
      <style>{`
        /* Hide video on mobile, show on desktop */
        .desktop-video { display: none; }
        @media (min-width: 1024px) {
          .desktop-video { display: block; }
          .mobile-bg { display: none; }
        }
        @keyframes wave-shift {
          0% { transform: translateX(-10%) translateY(-10%) rotate(0deg); }
          50% { transform: translateX(5%) translateY(5%) rotate(1deg); }
          100% { transform: translateX(-10%) translateY(-10%) rotate(0deg); }
        }
        @keyframes neural-pulse {
          0%, 100% { opacity: 0.6; filter: brightness(1) contrast(1); }
          50% { opacity: 0.8; filter: brightness(1.1) contrast(1.05); }
        }
        @keyframes glitch-slice {
          0% { clip-path: inset(0 0 0 0); transform: translate(0); }
          2% { clip-path: inset(20% -6px 60% 0); transform: translate(-2px, 2px); }
          4% { clip-path: inset(60% -6px 20% 0); transform: translate(2px, -2px); }
          6% { clip-path: inset(0 0 0 0); transform: translate(0); }
        }
        @keyframes chromatic-flicker {
          0%, 94%, 100% { opacity: 0; transform: scale(1); }
          95% { opacity: 0.2; transform: scale(1.01); filter: hue-rotate(90deg); }
          96% { opacity: 0; }
          97% { opacity: 0.15; transform: scale(0.99); filter: hue-rotate(-90deg); }
          98% { opacity: 0; }
        }
        @keyframes grain {
          0%, 100% { transform:translate(0, 0); }
          10% { transform:translate(-5%, -10%); }
          20% { transform:translate(-15%, 5%); }
          30% { transform:translate(7%, -25%); }
          40% { transform:translate(-5%, 25%); }
          50% { transform:translate(-15%, 10%); }
          60% { transform:translate(15%, 0%); }
          70% { transform:translate(0%, 15%); }
          80% { transform:translate(3%, 35%); }
          90% { transform:translate(-10%, 10%); }
        }
        @keyframes crt-flicker {
          0% { opacity: 0.01; }
          5% { opacity: 0.03; }
          10% { opacity: 0.015; }
          15% { opacity: 0.02; }
          20% { opacity: 0.01; }
          25% { opacity: 0.025; }
          30% { opacity: 0.01; }
          100% { opacity: 0.015; }
        }
        @keyframes scanline-roll {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes marching-scanlines {
          from { background-position: 0 0; }
          to { background-position: 0 12px; }
        }
        @keyframes wave-silver {
          0% { transform: translate(-100%, -100%) rotate(-40deg); }
          100% { transform: translate(100%, 100%) rotate(-40deg); }
        }
        @keyframes wave-orange {
          0% { transform: translate(100%, 100%) rotate(-40deg); }
          100% { transform: translate(-100%, -100%) rotate(-40deg); }
        }
      `}</style>

      {/* Mobile/Tablet Static Background */}
      <div 
        className="mobile-bg absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url('/media/aicodex_vector_wallpaper.png')`, 
          opacity: 0.9, 
          filter: 'blur(0.5px)'
        }}
      />

      {/* Desktop Animated Video Background */}
      {showVideo && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="desktop-video absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.2, filter: 'blur(0.5px)', objectPosition: 'center bottom' }}
        >
          <source src="/media/landscape_background.mp4" type="video/mp4" />
        </video>
      )}
      {/* Mandatory Watermark Mask - Radial Gradient from Bottom-Right */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle at bottom right, #E2E8F0 0%, #E2E8F0 12%, transparent 35%)',
          opacity: 0.95
        }}
      />
      {/* Shifting Gradient Overlay (The "Energy Wave") */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-[#FF6600]/5 via-transparent to-white/10 mix-blend-overlay"
        style={{ 
          animation: 'none' 
        }}
      />

      {/* Subtle Glitch Layer - occasionally "slices" the view */}
      {showGlitches && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-screen"
          style={{ 
            backgroundImage: `url('/media/aicodex_vector_wallpaper.png')`,
            animation: isDynamic ? 'glitch-slice 15s linear infinite' : 'none'
          }}
        />
      )}

      {/* Additional Chromatic Aberration Glitch - High Intensity, Low Frequency */}
      {showGlitches && (
        <div 
          className="absolute inset-0 bg-white opacity-0 mix-blend-overlay pointer-events-none"
          style={{ 
            animation: isDynamic ? 'chromatic-flicker 12s step-end infinite' : 'none'
          }}
        />
      )}
      
      {/* P5 Animated Grid and Traces */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 opacity-80" 
        style={{ filter: 'blur(1px)' }}
      />

      {/* CRT System Overlay - Scanlines, Vignette, and Phosphor Mask */}
      <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
        {/* Diagonal Marching Scanlines - Thicker 12px lines */}
        {showScanlines && (
          <div 
            className="absolute inset-[-50%] w-[200%] h-[200%] opacity-[0.1]"
            style={{ 
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.12) 50%)',
              backgroundSize: '100% 12px',
              transform: 'rotate(-40deg)',
              animation: isDynamic ? 'marching-scanlines 1s linear infinite' : 'none'
            }}
          />
        )}

        {/* The Great Silver Wave - Sweeping diagonal highlight */}
        {showWaves && (
          <div 
            className="absolute inset-[-100%] w-[300%] h-[300%] mix-blend-overlay pointer-events-none opacity-40"
            style={{ 
              background: 'linear-gradient(to bottom, transparent, rgba(192, 204, 218, 0.5), transparent)',
              animation: isDynamic ? 'wave-silver 12s linear infinite' : 'none',
              filter: 'blur(40px)'
            }}
          />
        )}

        {/* The Great Orange Wave - Counter-sweeping highlight */}
        {showWaves && (
          <div 
            className="absolute inset-[-100%] w-[300%] h-[300%] mix-blend-overlay pointer-events-none opacity-30"
            style={{ 
              background: 'linear-gradient(to bottom, transparent, rgba(255, 102, 0, 0.4), transparent)',
              animation: isDynamic ? 'wave-orange 18s linear infinite' : 'none',
              filter: 'blur(60px)'
            }}
          />
        )}

        {/* Rolling Scanline (The "Refresh" bar) */}
        {showScanlines && (
          <div 
            className="absolute w-full h-20 bg-white/10 opacity-30 pointer-events-none"
            style={{ 
              animation: isDynamic ? 'scanline-roll 10s linear infinite' : 'none',
              filter: 'blur(15px)'
            }}
          />
        )}

        {/* RGB Phosphor Grid (Ultra subtle) */}
        {showScanlines && (
          <div 
            className="absolute inset-0 w-full h-full opacity-[0.02]"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, rgba(255, 0, 0, 0.5), rgba(0, 255, 0, 0.5), rgba(0, 0, 255, 0.5))',
              backgroundSize: '3px 100%'
            }}
          />
        )}

        {/* Screen Flicker / Static Pulse - Switched to White for "Light Mode" CRT */}
        {showScanlines && (
          <div 
            className="absolute inset-0 w-full h-full bg-white pointer-events-none"
            style={{ 
              animation: isDynamic ? 'crt-flicker 0.15s infinite' : 'none'
            }}
          />
        )}

        {/* CRT Vignette (Tube shape) - Softened */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ 
            background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.15) 100%)',
            boxShadow: 'inset 0 0 80px rgba(255,255,255,0.05)'
          }}
        />
      </div>
    </div>
  );
};

export default P5Background;
