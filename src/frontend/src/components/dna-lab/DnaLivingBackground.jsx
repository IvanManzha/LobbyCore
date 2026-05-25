import React, { useEffect, useRef } from "react";

/**
 * Living background: deep gradient + soft noise + slow flow lines.
 * Respects prefers-reduced-motion (static).
 */
export default function DnaLivingBackground() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = canvas.getContext("2d");
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const lines = Array.from({ length: 8 }, (_, i) => ({
      y: (height / 9) * (i + 1) + Math.sin(i) * 30,
      speed: 0.02 + (i % 3) * 0.01,
      offset: i * 0.5,
    }));

    function draw() {
      ctx.clearRect(0, 0, width, height);
      t += 0.004;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.01)";
      ctx.lineWidth = 1;

      lines.forEach((line, i) => {
        ctx.beginPath();
        const baseY = line.y + Math.sin(t + line.offset) * 8;
        ctx.moveTo(0, baseY);

        for (let x = 0; x <= width + 50; x += 50) {
          const y = baseY + Math.sin((x / 200) + t * line.speed) * 15;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="dnaLivingBackground" aria-hidden="true" />;
}
