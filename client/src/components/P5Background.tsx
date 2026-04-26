import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

const P5Background: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let traces: Trace[] = [];
      let curves: Curve[] = [];
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
      };

      p.draw = () => {
        // Clear with slight alpha for trails
        p.clear(0, 0, 0, 0);
        
        // We use a CSS background, so we only draw the lines here
        p.noFill();

        curves.forEach(curve => {
          curve.update();
          curve.display();
        });

        traces.forEach(trace => {
          trace.update();
          trace.display();
        });
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
          this.p.stroke(100, 120, 255, 30); // Soft blue
          this.p.strokeWeight(1);
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
    <div className="fixed inset-0 -z-10 pointer-events-none">
      {/* Base Vector Wallpaper */}
      <div 
        className="absolute inset-0 bg-cover bg-end bg-no-repeat"
        style={{ backgroundImage: `url('/media/aicodex_vector_wallpaper.png')`, opacity: 1, filter: 'blur(1px)' }}
      />
      
      {/* P5 Animated Grid and Traces */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 opacity-80" 
        style={{ filter: 'blur(1px)' }}
      />
    </div>
  );
};

export default P5Background;
