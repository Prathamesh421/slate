import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ChatMessage, EmoteType, Move, Point, Shape, ToolMode, UserInfo } from "@/common/types";

export const userNameAtom = atomWithStorage<string>("dd_name", "");
export const mutedAtom = atomWithStorage<boolean>("dd_muted", false);

export const myIdAtom = atom<string>("");

export const movesAtom = atom<Move[]>([]);
export const usersAtom = atom<UserInfo[]>([]);
export const userMoveCountsAtom = atom<Record<string, number>>({});
export const myMovesStackAtom = atom<Move[]>([]);
export const redoStackAtom = atom<Move[]>([]);

export const modeAtom = atom<ToolMode>("draw");
export const shapeAtom = atom<Shape>("line");
export const lineColorAtom = atom<string>("#27272a");
export const fillColorAtom = atom<string>("rgba(0,0,0,0)");
export const lineWidthAtom = atom<number>(4);

export const selectionAtom = atom<string[]>([]);

export interface CursorInfo {
  pos: Point;
  name: string;
  color: string;
}
export const cursorsAtom = atom<Record<string, CursorInfo>>({});

export interface EmoteBurst {
  id: string;
  userId: string;
  type: EmoteType;
  x: number;
  y: number;
}
export const emoteBurstsAtom = atom<EmoteBurst[]>([]);

export const pendingImageAtom = atom<File | null>(null);

export interface SelectionAction {
  id: number;
  type: "move" | "copy" | "delete";
}
export const selectionActionAtom = atom<SelectionAction | null>(null);

export const chatAtom = atom<ChatMessage[]>([]);
export const chatOpenAtom = atom<boolean>(false);
export const chatUnreadAtom = atom<number>(0);

export type ModalState =
  | { kind: "notFound" }
  | { kind: "joinFail" }
  | { kind: "nameGate" }
  | null;
export const modalAtom = atom<ModalState>(null);

export const panAtom = atom<Point>({ x: 0, y: 0 });
export const toolbarOpenAtom = atom<boolean>(true);