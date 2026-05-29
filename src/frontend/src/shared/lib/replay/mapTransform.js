/**
 * World (map) coordinates to screen. Map size in cm (e.g. 306000). Origin top-left.
 * View: viewCenter (world), zoom (1 = fit), pan (pixels).
 * screen = (world - viewCenter) * k + container/2 + pan,  k = (min(W,H)/worldSize)*zoom
 */

/**
 * @param {number} x world x (cm)
 * @param {number} y world y (cm)
 * @param {number} worldSize
 * @param {{ width: number; height: number }} containerSize
 * @param {{ x: number; y: number }} viewCenter world
 * @param {number} zoom
 * @param {{ x: number; y: number }} pan pixels
 */
export function worldToScreen(x, y, worldSize, containerSize, viewCenter, zoom, pan) {
  const k = (Math.min(containerSize.width, containerSize.height) / worldSize) * zoom;
  const cx = containerSize.width / 2;
  const cy = containerSize.height / 2;
  return {
    x: (x - viewCenter.x) * k + cx + pan.x,
    y: (y - viewCenter.y) * k + cy + pan.y,
  };
}

/**
 * @param {number} screenX
 * @param {number} screenY
 * @param {number} worldSize
 * @param {{ width: number; height: number }} containerSize
 * @param {{ x: number; y: number }} viewCenter
 * @param {number} zoom
 * @param {{ x: number; y: number }} pan
 */
export function screenToWorld(screenX, screenY, worldSize, containerSize, viewCenter, zoom, pan) {
  const k = (Math.min(containerSize.width, containerSize.height) / worldSize) * zoom;
  const cx = containerSize.width / 2;
  const cy = containerSize.height / 2;
  return {
    x: viewCenter.x + (screenX - cx - pan.x) / k,
    y: viewCenter.y + (screenY - cy - pan.y) / k,
  };
}

export function getFitTransform(worldSize, containerSize) {
  return {
    viewCenter: { x: worldSize / 2, y: worldSize / 2 },
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
}

/**
 * @param {{ minX: number; minY: number; maxX: number; maxY: number }} bounds world
 * @param {{ width: number; height: number }} containerSize
 * @param {number} [padding]
 */
export function getFitToBoundsTransform(bounds, containerSize, padding = 40) {
  const { minX, minY, maxX, maxY } = bounds;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const viewCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const zoom = Math.min((containerSize.width - padding * 2) / w, (containerSize.height - padding * 2) / h);
  const clipZoom = Math.max(0.12, Math.min(1, zoom));
  return { viewCenter, zoom: clipZoom, pan: { x: 0, y: 0 } };
}

export function focusPoint(worldPoint) {
  return { viewCenter: { x: worldPoint.x, y: worldPoint.y }, zoom: 1, pan: { x: 0, y: 0 } };
}

export function worldToScreenScale(worldSize, containerSize, zoom) {
  return (Math.min(containerSize.width, containerSize.height) / worldSize) * zoom;
}
