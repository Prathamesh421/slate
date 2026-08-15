import type { Point } from "@/common/types";

export const BOARD_W = 4000;
export const BOARD_H = 2000;

export const viewport = {
  scale: 1,
  pan: { x: 0, y: 0 } as Point,
  w: 0,
  h: 0,
};

export function boardToViewport(p: Point): Point {
  return { x: p.x * viewport.scale + viewport.pan.x, y: p.y * viewport.scale + viewport.pan.y };
}

export function viewportToBoard(p: Point): Point {
  return { x: (p.x - viewport.pan.x) / viewport.scale, y: (p.y - viewport.pan.y) / viewport.scale };
}

export function fitScale(containerW: number, containerH: number): number {
  return Math.max(containerW / BOARD_W, containerH / BOARD_H);
}

export function clampPan(pan: Point, scale: number): Point {
  const margin = 240;
  const minX = Math.min(margin, viewport.w - BOARD_W * scale - margin);
  const maxX = Math.max(margin, viewport.w - BOARD_W * scale + margin);
  const minY = Math.min(margin, viewport.h - BOARD_H * scale - margin);
  const maxY = Math.max(margin, viewport.h - BOARD_H * scale + margin);
  return { x: Math.min(maxX, Math.max(minX, pan.x)), y: Math.min(maxY, Math.max(minY, pan.y)) };
}
