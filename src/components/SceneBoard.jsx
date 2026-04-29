import {
  Apple,
  BookOpen,
  CircleDot,
  Coffee,
  Keyboard,
  Mouse,
  PackageOpen,
  PenLine,
  Smartphone,
  Trash2,
  Wine
} from "lucide-react";

const iconMap = {
  cup: Coffee,
  book: BookOpen,
  apple: Apple,
  basket: PackageOpen,
  bottle: Wine,
  box: PackageOpen,
  keyboard: Keyboard,
  mouse: Mouse,
  phone: Smartphone,
  trash: Trash2,
  paper: Trash2,
  pen: PenLine
};

export default function SceneBoard({ objects, robot, activeObjectId, heldObjectId, movedObjects }) {
  const objectMap = new Map(objects.map((object) => [object.id, object]));

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="section-title">场景展示区</h2>
          <p className="section-subtitle">内置桌面仿真场景，坐标用于驱动动画。</p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          {objects.length} objects
        </span>
      </div>

      <div className="relative h-[410px] overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(90deg,rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.18)_1px,transparent_1px)] bg-[length:40px_40px]">
        <div className="absolute inset-x-8 bottom-8 top-8 rounded-lg border border-slate-300 bg-[#d9c6a5]/60 shadow-inner" />
        <div className="absolute right-12 top-10 rounded-md border border-dashed border-teal-500 bg-teal-50 px-2 py-1 text-xs text-teal-700">
          桌子右上角
        </div>
        <div className="absolute bottom-10 right-8 rounded-md border border-dashed border-amber-500 bg-amber-50 px-2 py-1 text-xs text-amber-700">
          收纳区
        </div>

        {objects.map((object) => {
          const moved = movedObjects[object.id];
          const basePosition = object.scenePosition || object.position || { x: 260, y: 180 };
          const left = moved?.x ?? basePosition.x;
          const top = moved?.y ?? basePosition.y;
          const Icon = iconMap[object.icon] || CircleDot;
          const isHeld = heldObjectId === object.id;
          const isActive = activeObjectId === object.id;

          return (
            <div
              key={object.id}
              className={`absolute grid h-14 w-14 place-items-center rounded-lg border bg-white shadow-sm transition-all duration-700 ${
                isActive ? "scale-110 border-signal ring-4 ring-signal/20" : "border-slate-200"
              } ${isHeld ? "opacity-25" : ""}`}
              style={{ left, top }}
              title={`${object.name} (${object.type})`}
            >
              <Icon size={25} color={object.color} aria-hidden="true" />
              <span className="absolute -bottom-5 whitespace-nowrap rounded bg-white px-1 text-xs text-slate-600">
                {object.name}
              </span>
            </div>
          );
        })}

        {heldObjectId && objectMap.has(heldObjectId) ? (
          <div
            className="absolute z-20 grid h-10 w-10 place-items-center rounded-lg border border-white bg-white shadow-md transition-all duration-700"
            style={{ left: robot.x + 25, top: robot.y - 8 }}
          >
            {(() => {
              const held = objectMap.get(heldObjectId);
              const Icon = iconMap[held.icon] || CircleDot;
              return <Icon size={20} color={held.color} aria-hidden="true" />;
            })()}
          </div>
        ) : null}

        <div
          className="robot absolute z-30 transition-all duration-700"
          style={{ left: robot.x, top: robot.y }}
          aria-label="机器人当前位置"
        >
          <div className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-ink text-white shadow-soft">
            <CircleDot size={29} aria-hidden="true" />
            <span className="absolute -bottom-6 rounded bg-ink px-2 py-0.5 text-xs text-white">Robot</span>
          </div>
        </div>
      </div>
    </section>
  );
}
