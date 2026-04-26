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
      const MAX_TRACES = 15;
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
        speed!: number;

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
          this.life = this.p.random(50, 150);
          this.speed = GRID_SIZE / 4;
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
          this.p.noFill(); // Prevents the shape from being filled (fixes the orange triangles)
          this.p.strokeWeight(2.5);
          this.p.stroke(255, 102, 0, 220); // AdaptivOrange brighter
          
          this.p.beginShape();
          this.history.forEach(pos => this.p.vertex(pos.x, pos.y));
          this.p.vertex(this.x, this.y);
          this.p.endShape();

          // Head glow
          this.p.noStroke();
          this.p.fill(255, 102, 0, 255);
          this.p.circle(this.x, this.y, 6); // Slightly larger head
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
    <div 
      ref={containerRef} 
      className="fixed inset-0 -z-10 pointer-events-none opacity-80" 
      style={{ filter: 'blur(0.5px)' }}
    />
  );
};

export default P5Background;
