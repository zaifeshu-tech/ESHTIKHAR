import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  RotateCcw,
  Eye,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
  Shield,
  Gauge,
  Sliders,
} from 'lucide-react';

export const LpgCylinder3DView: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI States (Dock Controls)
  const [explodedVal, setExplodedVal] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [gasFillPct, setGasFillPct] = useState<number>(100);
  const [activeCameraView, setActiveCameraView] = useState<'iso' | 'valve' | 'stamp' | 'exploded'>('iso');
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [cylinderFinish, setCylinderFinish] = useState<'standard_red' | 'commercial_blue' | 'safety_silver'>('standard_red');

  // Mutable refs to pass into animation loop without re-triggering Three.js mount
  const explodedRef = useRef<number>(0);
  const autoRotateRef = useRef<boolean>(true);
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(2.8, 1.8, 3.2));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.7, 0));
  const finishColorRef = useRef<number>(0xbd1e1e);

  useEffect(() => {
    explodedRef.current = explodedVal;
  }, [explodedVal]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    if (cylinderFinish === 'standard_red') finishColorRef.current = 0xbd1e1e;
    else if (cylinderFinish === 'commercial_blue') finishColorRef.current = 0x1d4ed8;
    else finishColorRef.current = 0x475569;
  }, [cylinderFinish]);

  useEffect(() => {
    if (activeCameraView === 'iso') {
      targetCameraPos.current.set(2.8, 1.8, 3.2);
      targetLookAt.current.set(0, 0.7, 0);
    } else if (activeCameraView === 'valve') {
      targetCameraPos.current.set(0.6, 1.7, 0.8);
      targetLookAt.current.set(0, 1.35, 0);
    } else if (activeCameraView === 'stamp') {
      targetCameraPos.current.set(1.2, 1.25, 0.4);
      targetLookAt.current.set(0, 1.1, 0);
    } else if (activeCameraView === 'exploded') {
      targetCameraPos.current.set(3.4, 2.2, 3.8);
      targetLookAt.current.set(0, 0.8, 0);
      setExplodedVal(0.85);
    }
  }, [activeCameraView]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 6, 16);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(2.8, 1.8, 3.2);

    // 2. High-Fidelity PBR Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Environment Map (PMREMGenerator + RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig (Warm Key + Cool Fill + Studio Rim)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 3.2);
    keyLight.position.set(4, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 2;
    keyLight.shadow.camera.bottom = -2;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.6);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // 5. Procedural Textures (Zero 404s, Sharp Anisotropy)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Contact shadow texture (procedural radial gradient)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(256, 256, 10, 256, 256, 240);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 512, 512);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.002;
    scene.add(shadowMesh);

    // Floor Studio Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Cylinder Stamping Canvas Texture
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 512;
    stampCanvas.height = 128;
    const stCtx = stampCanvas.getContext('2d')!;
    stCtx.fillStyle = '#b91c1c';
    stCtx.fillRect(0, 0, 512, 128);
    stCtx.fillStyle = '#fef08a';
    stCtx.font = 'bold 24px monospace';
    stCtx.fillText('BHARATGAS • TARE: 15.8 KG', 20, 48);
    stCtx.fillText('NET: 14.2 KG • TEST: 03/2026', 20, 96);

    const stampTex = new THREE.CanvasTexture(stampCanvas);
    stampTex.colorSpace = THREE.SRGBColorSpace;
    stampTex.anisotropy = maxAniso;

    // 6. Build Composite 10-Part Procedural 3D LPG Cylinder Model
    const cylinderGroup = new THREE.Group();

    // Reusable Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xbd1e1e,
      roughness: 0.32,
      metalness: 0.22,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.2,
      metalness: 0.88,
    });

    const steelCollarMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.45,
      metalness: 0.15,
    });

    const footRingMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.5,
      metalness: 0.15,
    });

    const valveHandwheelMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Sub-Groups for Exploded View separation
    const footRingGroup = new THREE.Group();
    const bodyGroup = new THREE.Group();
    const collarGroup = new THREE.Group();
    const valveGroup = new THREE.Group();

    // Part 1: Main Cylinder Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.72, 48);
    const barrelMesh = new THREE.Mesh(barrelGeo, bodyMat);
    barrelMesh.position.y = 0.52;
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    bodyGroup.add(barrelMesh);

    // Part 2: Upper Dished Dome
    const topDomeGeo = new THREE.SphereGeometry(0.38, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const topDomeMesh = new THREE.Mesh(topDomeGeo, bodyMat);
    topDomeMesh.scale.set(1, 0.45, 1);
    topDomeMesh.position.y = 0.88;
    topDomeMesh.castShadow = true;
    bodyGroup.add(topDomeMesh);

    // Part 3: Lower Dished Dome
    const bottomDomeGeo = new THREE.SphereGeometry(0.38, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const bottomDomeMesh = new THREE.Mesh(bottomDomeGeo, bodyMat);
    bottomDomeMesh.scale.set(1, -0.45, 1);
    bottomDomeMesh.position.y = 0.16;
    bottomDomeMesh.castShadow = true;
    bodyGroup.add(bottomDomeMesh);

    // Part 4: Central Circumferential Weld Seam
    const weldGeo = new THREE.TorusGeometry(0.384, 0.007, 16, 64);
    const weldMesh = new THREE.Mesh(weldGeo, bodyMat);
    weldMesh.rotation.x = Math.PI / 2;
    weldMesh.position.y = 0.52;
    bodyGroup.add(weldMesh);

    // Part 5: Bottom Stand Foot Ring (with ventilation openings)
    const footRingGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.14, 48, 1, true);
    const footRingMesh = new THREE.Mesh(footRingGeo, footRingMat);
    footRingMesh.position.y = 0.07;
    footRingMesh.castShadow = true;
    footRingGroup.add(footRingMesh);

    // Base Rim curled lip
    const baseLipGeo = new THREE.TorusGeometry(0.33, 0.012, 16, 48);
    const baseLipMesh = new THREE.Mesh(baseLipGeo, footRingMat);
    baseLipMesh.rotation.x = Math.PI / 2;
    baseLipMesh.position.y = 0.012;
    footRingGroup.add(baseLipMesh);

    // Part 6: Top Collar Ring / Handle Shroud (with 3 grip holes)
    const collarGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.22, 48, 1, true);
    const collarMesh = new THREE.Mesh(collarGeo, steelCollarMat);
    collarMesh.position.y = 1.15;
    collarMesh.castShadow = true;
    collarGroup.add(collarMesh);

    // Top Collar curled safety lip
    const collarLipGeo = new THREE.TorusGeometry(0.24, 0.012, 16, 48);
    const collarLipMesh = new THREE.Mesh(collarLipGeo, steelCollarMat);
    collarLipMesh.rotation.x = Math.PI / 2;
    collarLipMesh.position.y = 1.26;
    collarGroup.add(collarLipMesh);

    // Part 7: Brass Valve Body & Safety Relief Port
    const valveStemGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.16, 24);
    const valveStemMesh = new THREE.Mesh(valveStemGeo, brassMat);
    valveStemMesh.position.y = 1.11;
    valveStemMesh.castShadow = true;
    valveGroup.add(valveStemMesh);

    const reliefPortGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 16);
    const reliefPortMesh = new THREE.Mesh(reliefPortGeo, brassMat);
    reliefPortMesh.rotation.z = Math.PI / 2;
    reliefPortMesh.position.set(0.05, 1.12, 0);
    valveGroup.add(reliefPortMesh);

    // Part 8: Blue Safety Handwheel / Spindle
    const wheelHubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.025, 24);
    const wheelHubMesh = new THREE.Mesh(wheelHubGeo, valveHandwheelMat);
    wheelHubMesh.position.y = 1.21;
    valveGroup.add(wheelHubMesh);

    const wheelRimGeo = new THREE.TorusGeometry(0.065, 0.012, 12, 32);
    const wheelRimMesh = new THREE.Mesh(wheelRimGeo, valveHandwheelMat);
    wheelRimMesh.rotation.x = Math.PI / 2;
    wheelRimMesh.position.y = 1.21;
    valveGroup.add(wheelRimMesh);

    // Part 9: Tare Weight Stamp Plate on Collar
    const stampMat = new THREE.MeshBasicMaterial({
      map: stampTex,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const stampGeo = new THREE.PlaneGeometry(0.26, 0.07);
    const stampMesh = new THREE.Mesh(stampGeo, stampMat);
    stampMesh.position.set(0, 1.15, 0.265);
    collarGroup.add(stampMesh);

    // Assemble parts into hierarchical tree
    cylinderGroup.add(footRingGroup);
    cylinderGroup.add(bodyGroup);
    cylinderGroup.add(collarGroup);
    cylinderGroup.add(valveGroup);

    // Ground pivot flush
    cylinderGroup.position.set(0, 0, 0);
    scene.add(cylinderGroup);

    // Pre-allocate scratch vectors for 60fps loop
    const _currentLookAt = new THREE.Vector3(0, 0.7, 0);

    // Mouse drag interaction
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let yaw = 0.6;
    let pitch = 0.3;
    let radius = 4.2;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      yaw -= dx * 0.008;
      pitch = Math.max(-0.2, Math.min(1.3, pitch + dy * 0.008));
      autoRotateRef.current = false;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(1.8, Math.min(8.0, radius + e.deltaY * 0.003));
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Handle Window Resize
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 7. Silky-Smooth Animation Loop with Exponential Damping
    let animId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Update finish color dynamically
      if (bodyMat.color.getHex() !== finishColorRef.current) {
        bodyMat.color.setHex(finishColorRef.current);
        steelCollarMat.color.setHex(finishColorRef.current);
      }

      // Auto rotation
      if (autoRotateRef.current) {
        yaw += 0.4 * dt;
      }

      // Exploded View separation interpolation
      const targetSep = explodedRef.current;
      footRingGroup.position.y = THREE.MathUtils.damp(footRingGroup.position.y, -targetSep * 0.35, 8, dt);
      collarGroup.position.y = THREE.MathUtils.damp(collarGroup.position.y, targetSep * 0.4, 8, dt);
      valveGroup.position.y = THREE.MathUtils.damp(valveGroup.position.y, targetSep * 0.8, 8, dt);

      // Camera Orbit from Yaw/Pitch/Radius
      const idealCamX = _currentLookAt.x + radius * Math.cos(pitch) * Math.sin(yaw);
      const idealCamY = _currentLookAt.y + radius * Math.sin(pitch);
      const idealCamZ = _currentLookAt.z + radius * Math.cos(pitch) * Math.cos(yaw);

      camera.position.x = THREE.MathUtils.damp(camera.position.x, idealCamX, 6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, idealCamY, 6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, idealCamZ, 6, dt);

      _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, targetLookAt.current.x, 6, dt);
      _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, targetLookAt.current.y, 6, dt);
      _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, targetLookAt.current.z, 6, dt);

      camera.lookAt(_currentLookAt);

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // 8. Clean Resource Disposal
    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      barrelGeo.dispose();
      topDomeGeo.dispose();
      bottomDomeGeo.dispose();
      weldGeo.dispose();
      footRingGeo.dispose();
      baseLipGeo.dispose();
      collarGeo.dispose();
      collarLipGeo.dispose();
      valveStemGeo.dispose();
      reliefPortGeo.dispose();
      wheelHubGeo.dispose();
      wheelRimGeo.dispose();
      shadowGeo.dispose();
      stampGeo.dispose();

      bodyMat.dispose();
      brassMat.dispose();
      steelCollarMat.dispose();
      footRingMat.dispose();
      valveHandwheelMat.dispose();
      shadowMat.dispose();
      stampMat.dispose();
      shadowTex.dispose();
      stampTex.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[640px] sm:h-[720px] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl select-none">
      {/* 3D WebGL Canvas Mount (Isolated Ref Container) */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Title & Live Spec Badge */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-900/90 border border-slate-700/80 p-3 sm:p-4 rounded-2xl shadow-lg backdrop-blur-xs max-w-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              3D Technical Inspection
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-white mt-1">
            BharatGas 14.2 KG Domestic
          </h2>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px] font-mono border-t border-slate-800 pt-2 text-slate-300">
            <div>
              <span className="text-slate-500 block text-[9px]">TARE</span>
              15.8 KG
            </div>
            <div>
              <span className="text-slate-500 block text-[9px]">NET GAS</span>
              14.2 KG
            </div>
            <div>
              <span className="text-slate-500 block text-[9px]">GROSS</span>
              30.0 KG
            </div>
          </div>
        </div>
      </div>

      {/* Top Right Quick Actions */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-md ${
            autoRotate
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-slate-900/85 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Toggle Auto-Rotation"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span>Rotate</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCameraView('iso');
            setExplodedVal(0);
          }}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900/85 text-slate-300 border border-slate-700 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-md"
          title="Reset Camera"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Unified Ergonomic Bottom Control Dock (<= 15% Viewport Footprint) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-[880px] pointer-events-auto">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 sm:p-4 transition-all">
          {/* Collapse / Expand Toggle Button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Inspection Controls</span>
            </div>

            <button
              type="button"
              onClick={() => setIsDockCollapsed(!isDockCollapsed)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
            >
              <span>{isDockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
              {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!isDockCollapsed && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* 1. Exploded View Separation Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    Exploded Assembly
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {Math.round(explodedVal * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={explodedVal}
                  onChange={(e) => setExplodedVal(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* 2. Camera View Angle Pills */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  Camera Inspection Focus
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveCameraView('iso')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      activeCameraView === 'iso'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Iso
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCameraView('valve')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      activeCameraView === 'valve'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Valve
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCameraView('stamp')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      activeCameraView === 'stamp'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Stamp
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCameraView('exploded')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      activeCameraView === 'exploded'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Layers
                  </button>
                </div>
              </div>

              {/* 3. Cylinder Color / Coating Finish */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Coating Finish
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setCylinderFinish('standard_red')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      cylinderFinish === 'standard_red'
                        ? 'bg-red-700 text-white ring-1 ring-white/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Domestic
                  </button>
                  <button
                    type="button"
                    onClick={() => setCylinderFinish('commercial_blue')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      cylinderFinish === 'commercial_blue'
                        ? 'bg-blue-700 text-white ring-1 ring-white/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Commercial
                  </button>
                  <button
                    type="button"
                    onClick={() => setCylinderFinish('safety_silver')}
                    className={`py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      cylinderFinish === 'safety_silver'
                        ? 'bg-slate-600 text-white ring-1 ring-white/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Industrial
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
