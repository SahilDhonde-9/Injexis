import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

const SIZE = 160;
const CENTER = SIZE / 2;
const RADIUS = 70;
const PARTICLE_COUNT = 22;
const CONNECT_DIST = 55;

export function LogoWeb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SIZE;
    canvas.height = SIZE;

    particles.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const r = RADIUS * (0.4 + Math.random() * 0.7);
      return {
        x: CENTER + Math.cos(angle) * r,
        y: CENTER + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        size: Math.random() * 1.4 + 0.6,
      };
    });

    function draw() {
      ctx!.clearRect(0, 0, SIZE, SIZE);
      const pts = particles.current;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - CENTER;
        const dy = p.y - CENTER;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RADIUS) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.vx -= nx * 0.04;
          p.vy -= ny * 0.04;
        }
        if (dist < 18) {
          p.vx += dx * 0.01;
          p.vy += dy * 0.01;
        }
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]!;
          const b = pts[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) {
            const fade = 1 - d / CONNECT_DIST;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(220, 30, 30, ${fade * 0.55})`;
            ctx!.lineWidth = fade * 0.9;
            ctx!.stroke();
          }
        }
      }

      for (const p of pts) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 60, 60, 0.8)`;
        ctx!.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: SIZE, height: SIZE }}
    />
  );
}
