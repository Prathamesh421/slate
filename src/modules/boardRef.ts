import type { Point } from "@/common/types";

export const boardCanvas = { current: null as HTMLCanvasElement | null };

export const lastBoardPoint: Point = { x: -1, y: -1 };