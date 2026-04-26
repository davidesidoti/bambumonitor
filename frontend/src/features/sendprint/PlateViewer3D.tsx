import { useEffect, useRef, useState } from "react";

interface Props {
  jobId: number;
}

export function PlateViewer3D({ jobId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const { ThreeMFLoader } = await import(
        "three/examples/jsm/loaders/3MFLoader.js"
      );

      const width = host.clientWidth || 600;
      const height = host.clientHeight || 400;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111317);

      const camera = new THREE.PerspectiveCamera(
        45,
        width / height,
        0.1,
        2000,
      );
      camera.position.set(220, 220, 220);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(200, 400, 300);
      scene.add(key);

      const grid = new THREE.GridHelper(256, 32, 0x444a55, 0x282b31);
      grid.rotation.x = Math.PI / 2;
      scene.add(grid);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);

      const loader = new ThreeMFLoader();
      try {
        const res = await fetch(`/api/jobs/${jobId}/geometry`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (disposed) return;

        const root = loader.parse(buffer);
        root.rotation.x = -Math.PI / 2;

        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        box.getCenter(center);
        root.position.sub(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const dist = maxDim * 1.6;
        camera.position.set(dist, dist, dist);
        controls.update();

        scene.add(root);
        setLoading(false);
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : "render failed");
          setLoading(false);
        }
      }

      let frame = 0;
      const tick = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
      };
      tick();

      const onResize = () => {
        const w = host.clientWidth || 600;
        const h = host.clientHeight || 400;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        host.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [jobId]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border bg-[#111317]">
      <div ref={containerRef} className="h-full w-full" />
      {loading && !error && (
        <div className="absolute inset-0 grid place-items-center text-xs text-fg-3">
          Caricamento modello…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
