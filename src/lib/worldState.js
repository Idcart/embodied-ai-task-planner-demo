const SCENE_CANVAS = { width: 600, height: 400 };
const TABLE_LIMIT = 4.8;

export const emptyWorldState = {
  robot: {
    position: { x: 0, y: 0.35, z: 0 },
    holdingObjectId: null
  },
  objects: [],
  lastTask: null,
  lastExecutionResult: null
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function scenePointToWorld(point = {}) {
  const xPercent =
    typeof point.xPercent === "number"
      ? point.xPercent
      : ((point.x ?? SCENE_CANVAS.width / 2) / SCENE_CANVAS.width) * 100;
  const yPercent =
    typeof point.yPercent === "number"
      ? point.yPercent
      : ((point.y ?? SCENE_CANVAS.height / 2) / SCENE_CANVAS.height) * 100;

  return {
    x: clamp((xPercent - 50) / 10, -TABLE_LIMIT, TABLE_LIMIT),
    y: 0.34,
    z: clamp((yPercent - 50) / 10, -TABLE_LIMIT, TABLE_LIMIT)
  };
}

export function worldToScenePoint(position = {}) {
  const xPercent = clamp(position.x * 10 + 50, 0, 100);
  const yPercent = clamp(position.z * 10 + 50, 0, 100);

  return {
    x: Math.round((xPercent / 100) * SCENE_CANVAS.width),
    y: Math.round((yPercent / 100) * SCENE_CANVAS.height),
    xPercent: Number(xPercent.toFixed(2)),
    yPercent: Number(yPercent.toFixed(2))
  };
}

export function robotSceneToWorld(robot = {}) {
  const center = {
    x: Number(robot.x ?? 55) + 32,
    y: Number(robot.y ?? 70) + 32
  };
  const world = scenePointToWorld(center);
  return { x: world.x, y: 0.35, z: world.z };
}

export function robotWorldToScene(position = {}) {
  const scene = worldToScenePoint(position);
  return {
    x: Math.max(20, scene.x - 32),
    y: Math.max(20, scene.y - 32)
  };
}

export function getRegionFromScenePoint(point = {}) {
  const xPercent =
    typeof point.xPercent === "number"
      ? point.xPercent
      : ((point.x ?? SCENE_CANVAS.width / 2) / SCENE_CANVAS.width) * 100;
  const yPercent =
    typeof point.yPercent === "number"
      ? point.yPercent
      : ((point.y ?? SCENE_CANVAS.height / 2) / SCENE_CANVAS.height) * 100;

  const vertical = yPercent < 33 ? "top" : yPercent > 66 ? "bottom" : "center";
  const horizontal = xPercent < 33 ? "left" : xPercent > 66 ? "right" : "center";
  return vertical === "center" && horizontal === "center" ? "center" : `${vertical}_${horizontal}`;
}

export function getRegionFromWorld(position = {}) {
  return getRegionFromScenePoint(worldToScenePoint(position));
}

export function getTargetRegion(destination = "", position = null) {
  if (destination.includes("右上角")) return "top_right";
  if (destination.includes("左上角")) return "top_left";
  if (destination.includes("右下角")) return "bottom_right";
  if (destination.includes("左下角")) return "bottom_left";
  if (position) return getRegionFromScenePoint(position);
  return null;
}

export function initializeWorldState(objects = [], robotScenePosition) {
  const now = Date.now();
  return {
    robot: {
      position: robotSceneToWorld(robotScenePosition),
      holdingObjectId: null
    },
    objects: objects.map((object) => {
      const scenePoint = object.scenePosition || object.position || {};
      const sceneWithPercent = {
        ...scenePoint,
        xPercent: object.position?.xPercent,
        yPercent: object.position?.yPercent
      };
      const position = scenePointToWorld(sceneWithPercent);

      return {
        id: object.id,
        name: object.name,
        type: object.type,
        position,
        originalPosition: position,
        currentRegion: object.position?.region || getRegionFromWorld(position),
        targetRegion: null,
        isHeld: false,
        isPlaced: false,
        lastUpdatedAt: now
      };
    }),
    lastTask: null,
    lastExecutionResult: null
  };
}

export function mergeObjectsWithWorldState(objects = [], worldState = emptyWorldState) {
  const stateMap = new Map(worldState.objects.map((object) => [object.id, object]));

  return objects.map((object) => {
    const stateObject = stateMap.get(object.id);
    if (!stateObject) return object;

    const scene = worldToScenePoint(stateObject.position);
    return {
      ...object,
      position: {
        ...(object.position || {}),
        x: scene.x,
        y: scene.y,
        xPercent: scene.xPercent,
        yPercent: scene.yPercent,
        region: stateObject.currentRegion
      },
      scenePosition: { x: scene.x, y: scene.y }
    };
  });
}

export function getMovedObjectsFromWorldState(worldState = emptyWorldState) {
  return Object.fromEntries(
    worldState.objects.map((object) => {
      const scene = worldToScenePoint(object.position);
      return [object.id, { x: scene.x, y: scene.y }];
    })
  );
}

export function isObjectInTargetRegion(objectState, targetRegion) {
  if (!objectState || !targetRegion) return false;
  return objectState.currentRegion === targetRegion;
}
