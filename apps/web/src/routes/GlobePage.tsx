import createGlobe from "cobe";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MOCK_EVENTS } from "../lib/mockData";

export default function GlobePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<(typeof MOCK_EVENTS)[number] | null>(
    null,
  );
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Mutable refs so the globe's onRender callback isn't stuck with a stale closure.
  const phiRef = useRef(0);
  const thetaRef = useRef(0.25);
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef<{ mx: number; my: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      draggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      draggingRef.current = false;
      canvas.style.cursor = "grab";
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      pointerRef.current = {
        mx: (e.clientX - cx) / (rect.width / 2),
        my: (e.clientY - cy) / (rect.height / 2),
      };

      if (draggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        phiRef.current += dx * 0.005;
        thetaRef.current = Math.max(
          -0.8,
          Math.min(0.8, thetaRef.current + dy * 0.005),
        );
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }

      // Hover detection in screen space.
      let found: (typeof MOCK_EVENTS)[number] | null = null;
      const phi = phiRef.current;
      const theta = thetaRef.current;
      for (const ev of MOCK_EVENTS) {
        // Cobe's coordinate convention: longitude rotates around y, latitude offsets in projection.
        // We mirror its math here for click/hover hit-testing.
        const lat = (ev.lat * Math.PI) / 180;
        const lng = (ev.lng * Math.PI) / 180;
        const sx = Math.cos(lat) * Math.sin(lng + phi);
        const sy =
          Math.sin(lat) * Math.cos(theta) -
          Math.cos(lat) * Math.cos(lng + phi) * Math.sin(theta);
        const sz =
          Math.cos(lat) * Math.cos(lng + phi) * Math.cos(theta) +
          Math.sin(lat) * Math.sin(theta);
        if (sz > 0.1 && pointerRef.current) {
          const d = Math.hypot(
            sx - pointerRef.current.mx,
            sy - pointerRef.current.my,
          );
          if (d < 0.08) {
            found = ev;
            break;
          }
        }
      }
      setHovered(found);
      setHoverPos({ x: e.clientX, y: e.clientY });
      canvas.style.cursor = found
        ? "pointer"
        : draggingRef.current
          ? "grabbing"
          : "grab";
    };

    const onClick = () => {
      if (hovered) navigate(`/events/${hovered.id}`);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("click", onClick);

    const size = canvas.clientWidth;
    const globe = createGlobe(canvas, {
      devicePixelRatio: window.devicePixelRatio || 2,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 16000,
      mapBrightness: 5.5,
      // Warm orange ↔ violet to match the rest of the app.
      baseColor: [0.18, 0.12, 0.08],
      markerColor: [0.97, 0.45, 0.09],
      glowColor: [0.55, 0.28, 0.55],
      markers: MOCK_EVENTS.map((e) => ({
        location: [e.lat, e.lng] as [number, number],
        size: e.featured ? 0.09 : 0.06,
      })),
      onRender: (state) => {
        if (!draggingRef.current) {
          phiRef.current += 0.0025;
        }
        state.phi = phiRef.current;
        state.theta = thetaRef.current;
      },
    });

    canvas.style.cursor = "grab";

    const onResize = () => {
      // cobe doesn't support resize natively; for our purposes the fixed pixel
      // ratio handles most cases. Reload on big window changes if needed.
    };
    window.addEventListener("resize", onResize);

    return () => {
      globe.destroy();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="badge-violet">Interactive</span>
          <h1 className="mt-2 font-display text-4xl">
            <span className="gradient-text">Explore the globe</span>
          </h1>
          <p className="mt-1 text-surface-300">
            Drag to rotate · hover a pin · click to open an event.
          </p>
        </div>
        <Link to="/" className="btn-secondary">
          ← Back to map
        </Link>
      </div>

      <div className="relative">
        <div
          className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-3xl"
          style={{
            background:
              "radial-gradient(circle at center, rgba(249,115,22,0.10), transparent 70%), #08050a",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "100%",
              aspectRatio: "1",
            }}
          />
        </div>

        {hovered && hoverPos && (
          <div
            className="pointer-events-none fixed z-50 max-w-xs"
            style={{
              left: Math.min(hoverPos.x + 16, window.innerWidth - 320),
              top: Math.min(hoverPos.y + 16, window.innerHeight - 160),
            }}
          >
            <div className="card pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="badge">{hovered.category}</span>
                {hovered.featured && <span className="badge-violet">★</span>}
              </div>
              <p className="mt-1 font-medium">{hovered.title}</p>
              <p className="text-xs text-surface-400">
                {hovered.city} ·{" "}
                {new Date(hovered.starts_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-brand-300">Click to open →</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_EVENTS.slice(0, 6).map((e) => (
          <Link
            key={e.id}
            to={`/events/${e.id}`}
            className="card-hover overflow-hidden p-0"
          >
            {e.hero_image_url && (
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${e.hero_image_url})` }}
              />
            )}
            <div className="p-3">
              <span className="badge">{e.category}</span>
              <p className="mt-1 font-medium text-surface-100">{e.title}</p>
              <p className="text-xs text-surface-400">
                {e.city} · {new Date(e.starts_at).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
