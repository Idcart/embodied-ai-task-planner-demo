export const calibrationConfig = {
  tableWidthMeter: 0.6,
  tableDepthMeter: 0.4,
  robotOrigin: { x: 0, y: 0, z: 0 },
  zPickHeight: 0.05,
  zSafeHeight: 0.15
};

const regionPercentMap = {
  top_left: { xPercent: 18, yPercent: 18 },
  top_center: { xPercent: 50, yPercent: 18 },
  top_right: { xPercent: 82, yPercent: 18 },
  center_left: { xPercent: 18, yPercent: 50 },
  center: { xPercent: 50, yPercent: 50 },
  center_right: { xPercent: 82, yPercent: 50 },
  bottom_left: { xPercent: 18, yPercent: 82 },
  bottom_center: { xPercent: 50, yPercent: 82 },
  bottom_right: { xPercent: 82, yPercent: 82 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundMeter(value) {
  return Number(value.toFixed(3));
}

export function imageToVirtual3D(xPercent = 50, yPercent = 50) {
  const x = clamp((Number(xPercent) - 50) / 10, -4.8, 4.8);
  const z = clamp((Number(yPercent) - 50) / 10, -4.8, 4.8);
  return { x, y: 0.34, z };
}

export function virtual3DToRobotCoord(virtualPosition = {}, config = calibrationConfig) {
  const xNormalized = clamp(Number(virtualPosition.x ?? 0) / 5, -1, 1);
  const zNormalized = clamp(Number(virtualPosition.z ?? 0) / 5, -1, 1);

  return {
    x: roundMeter(config.robotOrigin.x + (xNormalized * config.tableWidthMeter) / 2),
    y: roundMeter(config.robotOrigin.y + (zNormalized * config.tableDepthMeter) / 2),
    z: roundMeter(config.zPickHeight),
    unit: "meter"
  };
}

export function regionToRobotCoord(region, config = calibrationConfig) {
  const percent = regionPercentMap[region];
  if (!percent) return null;
  return virtual3DToRobotCoord(imageToVirtual3D(percent.xPercent, percent.yPercent), config);
}

export function getSafeRobotCoord(position = {}, config = calibrationConfig) {
  return {
    ...position,
    z: roundMeter(Math.max(Number(position.z ?? 0), config.zSafeHeight)),
    unit: "meter"
  };
}

export function isRobotCoordInTable(position = {}, config = calibrationConfig) {
  const halfWidth = config.tableWidthMeter / 2;
  const halfDepth = config.tableDepthMeter / 2;
  return (
    Number(position.x) >= -halfWidth &&
    Number(position.x) <= halfWidth &&
    Number(position.y) >= -halfDepth &&
    Number(position.y) <= halfDepth
  );
}
