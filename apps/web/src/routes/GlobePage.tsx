import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";
import { MOCK_EVENTS } from "../lib/mockData";

// Convert lat/lng (degrees) to a Vector3 on a unit sphere of given radius.
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export default function GlobePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<(typeof MOCK_EVENTS)[number] | null>(
    null,
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Sphere (the globe).
    const radius = 2.2;
    const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x1a140f,
      emissive: 0x140a04,
      shininess: 8,
      transparent: true,
      opacity: 0.95,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // Wireframe overlay (gives that "data globe" look).
    const wireGeo = new THREE.SphereGeometry(radius * 1.001, 32, 32);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    scene.add(new THREE.Mesh(wireGeo, wireMat));

    // Atmosphere halo
    const haloGeo = new THREE.SphereGeometry(radius * 1.18, 64, 64);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      uniforms: {
        c: { value: 0.5 },
        p: { value: 4.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float c;
        uniform float p;
        void main() {
          float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
          gl_FragColor = vec4(0.97, 0.45, 0.09, 1.0) * intensity;
        }
      `,
    });
    scene.add(new THREE.Mesh(haloGeo, haloMat));

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffd9a8, 1.1);
    dir.position.set(5, 3, 5);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x8b5cf6, 0.4);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    // Event pins
    const pinGroup = new THREE.Group();
    const pinMeshes: {
      mesh: THREE.Mesh;
      event: (typeof MOCK_EVENTS)[number];
    }[] = [];
    const pinGeo = new THREE.SphereGeometry(0.04, 16, 16);

    for (const ev of MOCK_EVENTS) {
      const pos = latLngToVec3(ev.lat, ev.lng, radius * 1.02);
      const mat = new THREE.MeshBasicMaterial({
        color: ev.featured ? 0xfbbf24 : 0xf97316,
      });
      const mesh = new THREE.Mesh(pinGeo, mat);
      mesh.position.copy(pos);
      mesh.userData = { eventId: ev.id };
      pinGroup.add(mesh);
      pinMeshes.push({ mesh, event: ev });

      // Outer glow ring
      const ringGeo = new THREE.SphereGeometry(0.07, 16, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ev.featured ? 0xfbbf24 : 0xf97316,
        transparent: true,
        opacity: 0.3,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      pinGroup.add(ring);
    }
    scene.add(pinGroup);

    // Stars background
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 800; i++) {
      const r = 80 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
    }
    starGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        sizeAttenuation: true,
      }),
    );
    scene.add(stars);

    // Drag-to-rotate
    let isDragging = false;
    let prev = { x: 0, y: 0 };
    let rotX = 0;
    let rotY = 0;
    let velY = 0.0015;

    const onDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const p = "touches" in e ? e.touches[0] : (e as MouseEvent);
      prev = { x: p.clientX, y: p.clientY };
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const p = "touches" in e ? e.touches[0] : (e as MouseEvent);
      const dx = p.clientX - prev.x;
      const dy = p.clientY - prev.y;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      prev = { x: p.clientX, y: p.clientY };
      velY = 0;
    };
    const onUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    renderer.domElement.addEventListener("touchstart", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    // Hover detection via raycast
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    renderer.domElement.addEventListener("mousemove", onPointerMove);

    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging) {
        rotY += velY;
      }
      sphere.rotation.y = rotY;
      sphere.rotation.x = rotX;
      pinGroup.rotation.y = rotY;
      pinGroup.rotation.x = rotX;
      stars.rotation.y += 0.0001;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        pinMeshes.map((p) => p.mesh),
        false,
      );
      if (hits.length > 0) {
        const target = pinMeshes.find((p) => p.mesh === hits[0].object);
        if (target) setHovered(target.event);
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHovered(null);
        renderer.domElement.style.cursor = "grab";
      }

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("touchstart", onDown);
      renderer.domElement.removeEventListener("mousemove", onPointerMove);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      pinGeo.dispose();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
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
          ref={mountRef}
          className="h-[600px] w-full overflow-hidden rounded-2xl"
          style={{
            background:
              "radial-gradient(circle at center, rgba(249,115,22,0.08), transparent 70%), #08050a",
          }}
        />

        {hovered && (
          <Link
            to={`/events/${hovered.id}`}
            className="card-hover absolute right-4 top-4 max-w-sm"
          >
            <div className="flex gap-3">
              {hovered.hero_image_url && (
                <div
                  className="h-16 w-24 shrink-0 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${hovered.hero_image_url})` }}
                />
              )}
              <div>
                <div className="flex gap-2">
                  <span className="badge">{hovered.category}</span>
                  {hovered.featured && <span className="badge-violet">★</span>}
                </div>
                <h3 className="mt-1 font-medium">{hovered.title}</h3>
                <p className="text-xs text-surface-400">
                  {hovered.city} ·{" "}
                  {new Date(hovered.starts_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Link>
        )}

        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="badge">{MOCK_EVENTS.length} events worldwide</span>
        </div>
      </div>
    </div>
  );
}
