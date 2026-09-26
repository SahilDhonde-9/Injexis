import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

const CONNECTION_DISTANCE = 140;
const NODE_COUNT = 80;
const EDGE_BIAS = 0.72;

function randomEdgeBiased(max: number): number {
  if (Math.random() < EDGE_BIAS) {
    const side = Math.random();
    if (side < 0.25) return Math.random() * max * 0.22;
    if (side < 0.5) return max - Math.random() * max * 0.22;
    if (side < 0.75) return Math.random() * max * 0.18 + Math.random() * max * 0.82;
    return Math.random() * max;
  }
  return Math.random() * max;
}

export function SpiderWeb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes();
    };

    function initNodes() {
      nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
        x: randomEdgeBiased(canvas!.width),
        y: randomEdgeBiased(canvas!.height),
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
      }));
    }

    function edgeProximityAlpha(x: number, y: number, w: number, h: number): number {
      const margin = 220;
      const dx = Math.min(x, w - x);
      const dy = Math.min(y, h - y);
      const nearEdge = Math.min(dx, dy);
      if (nearEdge > margin) return 0.06;
      return 0.06 + (1 - nearEdge / margin) * 0.45;
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -50) n.x = w + 50;
        if (n.x > w + 50) n.x = -50;
        if (n.y < -50) n.y = h + 50;
        if (n.y > h + 50) n.y = -50;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const proximityFade = 1 - dist / CONNECTION_DISTANCE;
            const edgeAlpha =
              (edgeProximityAlpha(a.x, a.y, w, h) + edgeProximityAlpha(b.x, b.y, w, h)) / 2;
            const alpha = proximityFade * edgeAlpha;

            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx!.lineWidth = proximityFade * 0.8;
            ctx!.stroke();
          }
        }
      }

      for (const n of nodes) {
        const ea = edgeProximityAlpha(n.x, n.y, w, h);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(99, 160, 255, ${ea * n.opacity})`;
        ctx!.fill();

        if (ea > 0.3) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.size + 2, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(59, 130, 246, ${ea * 0.15})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
