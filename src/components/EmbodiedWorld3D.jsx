import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { actionLabels } from "../lib/constants";

const TABLE_LIMIT = 4.8;
const CANVAS_SIZE = { width: 600, height: 400 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentToWorld(xPercent = 50, yPercent = 50) {
  return {
    x: clamp((Number(xPercent) - 50) / 10, -TABLE_LIMIT, TABLE_LIMIT),
    z: clamp((Number(yPercent) - 50) / 10, -TABLE_LIMIT, TABLE_LIMIT)
  };
}

function scenePointToWorld(point = {}) {
  const xPercent = typeof point.x === "number" ? (point.x / CANVAS_SIZE.width) * 100 : 50;
  const yPercent = typeof point.y === "number" ? (point.y / CANVAS_SIZE.height) * 100 : 50;
  return percentToWorld(xPercent, yPercent);
}

function getObjectWorldPosition(object, movedObjects, heldObjectId, robotWorld) {
  if (heldObjectId === object.id) {
    return { x: robotWorld.x, y: 0.62, z: robotWorld.z - 0.16 };
  }

  const moved = movedObjects[object.id];
  if (moved) {
    const world = scenePointToWorld(moved);
    return { x: world.x, y: 0.34, z: world.z };
  }

  const position = object.position || {};
  const world =
    typeof position.xPercent === "number" || typeof position.yPercent === "number"
      ? percentToWorld(position.xPercent, position.yPercent)
      : scenePointToWorld(object.scenePosition || object.position);

  return { x: world.x, y: 0.34, z: world.z };
}

function getRobotWorldPosition(robot = {}) {
  const center = {
    x: (Number(robot.x ?? 55) + 32) / CANVAS_SIZE.width,
    y: (Number(robot.y ?? 70) + 32) / CANVAS_SIZE.height
  };
  const world = percentToWorld(center.x * 100, center.y * 100);
  return { x: world.x, y: 0.35, z: world.z };
}

function getStepWorldPosition(step) {
  if (!step?.position) return null;
  const world = scenePointToWorld(step.position);
  return { x: world.x, y: 0.38, z: world.z };
}

function PathLine({ path }) {
  const geometry = useMemo(() => {
    const points = path.map((point) => {
        const world = getRobotWorldPosition(point);
        return new THREE.Vector3(world.x, 0.26, world.z);
      });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [path]);

  if (path.length < 2) return null;

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial attach="material" color="#f59e0b" linewidth={3} transparent opacity={0.9} />
    </line>
  );
}

function TargetArea({ position, label }) {
  if (!position) return null;
  const world = scenePointToWorld(position);

  return (
    <group position={[world.x, 0.18, world.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 48]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.24} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 64]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 0.34, 0]} distanceFactor={7}>
        <span className="world-label zone-label">{label || "目标区域"}</span>
      </Html>
    </group>
  );
}

function SmoothGroup({ target, children }) {
  const ref = useRef(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(target.x, target.y, target.z), Math.min(1, delta * 5));
  });

  return (
    <group ref={ref} position={[target.x, target.y, target.z]}>
      {children}
    </group>
  );
}

function ObjectMesh({ object, position, active }) {
  const color = object.color || "#14b8a6";
  const type = object.type || "unknown";

  return (
    <SmoothGroup target={position}>
      <group scale={active ? 1.16 : 1}>
        {type === "cup" ? (
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.18, 0.55, 32]} />
            <meshStandardMaterial color={color} metalness={0.08} roughness={0.45} />
          </mesh>
        ) : null}

        {type === "book" ? (
          <mesh castShadow>
            <boxGeometry args={[0.88, 0.18, 0.52]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        ) : null}

        {type === "phone" ? (
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.08, 0.86]} />
            <meshStandardMaterial color="#05070a" metalness={0.3} roughness={0.25} />
          </mesh>
        ) : null}

        {type === "apple" ? (
          <mesh castShadow>
            <sphereGeometry args={[0.28, 32, 32]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        ) : null}

        {type === "bottle" ? (
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.78, 32]} />
            <meshStandardMaterial color={color} metalness={0.12} roughness={0.34} />
          </mesh>
        ) : null}

        {!["cup", "book", "phone", "apple", "bottle"].includes(type) ? (
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.38, 0.5]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
        ) : null}

        {active ? (
          <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.52, 48]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
        ) : null}

        <Html center distanceFactor={9} position={[0, 0.62, 0]}>
          <span className={`world-label ${active ? "world-label-active" : ""}`}>{object.name}</span>
        </Html>
      </group>
    </SmoothGroup>
  );
}

function Robot({ position }) {
  return (
    <SmoothGroup target={position}>
      <group>
        <mesh castShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[0.72, 0.28, 0.52]} />
          <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0.18, 0.35, 0]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color="#22d3ee" emissive="#0e7490" emissiveIntensity={0.4} />
        </mesh>
        {[-0.28, 0.28].map((x) =>
          [-0.23, 0.23].map((z) => (
            <mesh key={`${x}-${z}`} castShadow position={[x, -0.08, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.08, 20]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          ))
        )}
        <Html center distanceFactor={9} position={[0, 0.78, 0]}>
          <span className="world-label robot-label">Robot</span>
        </Html>
      </group>
    </SmoothGroup>
  );
}

function TableScene({ objects, robot, activeObjectId, heldObjectId, movedObjects, robotPath, targetAreaPosition, plan, currentStep }) {
  const robotWorld = useMemo(() => getRobotWorldPosition(robot), [robot]);
  const currentPlanStep = useMemo(
    () => plan.find((step) => step.step === currentStep) || null,
    [currentStep, plan]
  );
  const stepWorld = getStepWorldPosition(currentPlanStep);
  const targetAreaLabel = currentPlanStep?.targetArea || plan.find((step) => step.targetArea)?.targetArea || "目标区域";

  return (
    <>
      <color attach="background" args={["#07111f"]} />
      <fog attach="fog" args={["#07111f", 9, 18]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.7} position={[4, 7, 5]} shadow-mapSize={[2048, 2048]} />
      <pointLight intensity={1.4} color="#38bdf8" position={[-4, 4, -4]} />

      <group>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[10.5, 0.22, 10.5]} />
          <meshStandardMaterial color="#263645" roughness={0.62} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 10, 20, 20]} />
          <meshBasicMaterial color="#3dd6c6" wireframe transparent opacity={0.16} />
        </mesh>
      </group>

      <TargetArea position={targetAreaPosition} label={targetAreaLabel} />

      {objects.map((object) => (
        <ObjectMesh
          key={object.id}
          object={object}
          position={getObjectWorldPosition(object, movedObjects, heldObjectId, robotWorld)}
          active={activeObjectId === object.id || currentPlanStep?.objectId === object.id}
        />
      ))}

      {stepWorld ? (
        <group position={[stepWorld.x, stepWorld.y, stepWorld.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.72, 0.84, 64]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <Html center position={[0, 0.42, 0]} distanceFactor={7}>
            <span className="world-label step-label">
              Step {currentPlanStep.step} · {actionLabels[currentPlanStep.action] || currentPlanStep.action}
            </span>
          </Html>
        </group>
      ) : null}

      <Robot position={robotWorld} />
      <PathLine path={robotPath || []} />
      <ContactShadows opacity={0.42} blur={2.6} position={[0, 0.14, 0]} scale={10} />
    </>
  );
}

export default function EmbodiedWorld3D({
  objects,
  robot,
  activeObjectId,
  heldObjectId,
  movedObjects,
  robotPath,
  targetAreaPosition,
  plan,
  currentStep
}) {
  const currentPlanStep = plan.find((step) => step.step === currentStep);

  return (
    <section className="rounded-lg border border-slate-800/20 bg-[#0b1220] p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">3D 虚拟空间</h2>
          <p className="mt-1 text-sm text-cyan-100/70">桌面坐标由 xPercent / yPercent 映射，支持拖拽旋转和滚轮缩放。</p>
        </div>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
          {objects.length} objects
        </span>
      </div>

      <div className="relative h-[680px] overflow-hidden rounded-lg border border-cyan-200/15 bg-[#07111f]">
        <Canvas shadows camera={{ position: [5.8, 6, 7.2], fov: 45 }}>
          <Suspense fallback={null}>
            <TableScene
              objects={objects}
              robot={robot}
              activeObjectId={activeObjectId}
              heldObjectId={heldObjectId}
              movedObjects={movedObjects}
              robotPath={robotPath}
              targetAreaPosition={targetAreaPosition}
              plan={plan}
              currentStep={currentStep}
            />
          </Suspense>
          <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={14} maxPolarAngle={Math.PI / 2.08} />
        </Canvas>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-cyan-50 backdrop-blur">
          <p className="font-semibold">闭环状态</p>
          <p className="mt-1 text-cyan-100/80">
            {currentPlanStep ? `正在执行 Step ${currentPlanStep.step}: ${currentPlanStep.description}` : "等待执行计划"}
          </p>
        </div>
      </div>
    </section>
  );
}
