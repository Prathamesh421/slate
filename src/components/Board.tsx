"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  fillColorAtom,
  lineColorAtom,
  lineWidthAtom,
  modeAtom,
  movesAtom,
  myMovesStackAtom,
  panAtom,
  pendingImageAtom,
  redoStackAtom,
  selectionActionAtom,
  selectionAtom,
  shapeAtom,
} from "@/atoms/room";
import type { CtxMode, Move, Point, Shape, ToolMode } from "@/common/types";
import { boardCanvas, lastBoardPoint } from "@/modules/boardRef";
import { notify } from "@/modules/notify";
import { getSocket } from "@/modules/socket";
import { useSound } from "@/modules/sound";
import { Copy, Move as MoveIcon, Trash2 } from "lucide-react";
import {
  BOARD_H,
  BOARD_W,
  boardToViewport,
  clampPan,
  fitScale,
  viewport,
  viewportToBoard,
} from "@/modules/viewport";

const MIN_MOVE = 2;

interface StrokeState {
  start: Point;
  points: Point[];
  mode: CtxMode;
  shape: Shape;
  shift: boolean;
}

type ActiveState =
  | { kind: "pan"; startClient: Point; startPan: Point }
  | { kind: "stroke"; stroke: StrokeState }
  | { kind: "select"; startBoard: Point; endBoard: Point }
  | null;

type Preview =
  | { kind: "path"; points: Point[]; width: number; color: string; mode: CtxMode }
  | {
      kind: "shape";
      shape: "rect" | "circle";
      x: number;
      y: number;
      w: number;
      h: number;
      width: number;
      color: string;
      fill: string;
      mode: CtxMode;
    }
  | { kind: "img"; img: HTMLImageElement; x: number; y: number; w: number; h: number }
  | null;

interface ImageGhost {
  img: HTMLImageElement;
  w: number;
  h: number;
  x: number;
  y: number;
}

interface MoveGhost {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  offX: number;
  offY: number;
}

interface SelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function Board() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const movesRef = useRef<Move[]>([]);
  const imgCacheRef = useRef(new Map<string, HTMLImageElement>());
  const prevMovesLenRef = useRef(0);

  const [moves] = useAtom(movesAtom);
  const mode = useAtomValue(modeAtom);
  const shape = useAtomValue(shapeAtom);
  const lineColor = useAtomValue(lineColorAtom);
  const fillColor = useAtomValue(fillColorAtom);
  const lineWidth = useAtomValue(lineWidthAtom);
  const redoStack = useAtomValue(redoStackAtom);
  const myStack = useAtomValue(myMovesStackAtom);
  const pan = useAtomValue(panAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const [selectionAction, setSelectionAction] = useAtom(selectionActionAtom);
  const setPanAtom = useSetAtom(panAtom);

  const modeRef = useRef<ToolMode>(mode);
  const shapeRef = useRef<Shape>(shape);
  const lineColorRef = useRef(lineColor);
  const fillColorRef = useRef(fillColor);
  const lineWidthRef = useRef(lineWidth);
  const selectionRef = useRef<string[]>(selection);
  const redoRef = useRef<Move[]>(redoStack);
  const myStackCountRef = useRef(myStack.length);
  const redoBusyRef = useRef(false);

  useEffect(() => {
    movesRef.current = moves;
    modeRef.current = mode;
    shapeRef.current = shape;
    lineColorRef.current = lineColor;
    fillColorRef.current = fillColor;
    lineWidthRef.current = lineWidth;
    selectionRef.current = selection;
    redoRef.current = redoStack;
    myStackCountRef.current = myStack.length;
  }, [fillColor, lineColor, lineWidth, mode, moves, myStack.length, redoStack, selection, shape]);

  const activeRef = useRef<ActiveState>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const previewRef = useRef<Preview>(null);
  const lastMouseRef = useRef<Point>({ x: 0, y: 0 });
  const lastSentMouseRef = useRef<Point>({ x: -1, y: -1 });
  const drawRafRef = useRef(0);

  const [imageGhost, setImageGhost] = useState<ImageGhost | null>(null);
  const imageGhostRef = useRef<ImageGhost | null>(null);

  const [moveGhost, setMoveGhost] = useState<MoveGhost | null>(null);
  const moveGhostRef = useRef<MoveGhost | null>(null);

  const [selRect, setSelRect] = useState<SelRect | null>(null);
  const [panning, setPanning] = useState(false);
  const [pendingImage, setPendingImage] = useAtom(pendingImageAtom);

  useEffect(() => {
    if (!pendingImage) return;
    handleImageFile(pendingImage);
    setPendingImage(null);
  }, [pendingImage, setPendingImage]);

  useEffect(() => {
    imageGhostRef.current = imageGhost;
    moveGhostRef.current = moveGhost;
  }, [imageGhost, moveGhost]);

  const { place, pop } = useSound();

  const scheduleDrawRef = useRef<() => void>(() => {});
  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      for (const move of movesRef.current) {
        drawMove(ctx, move, imgCacheRef.current, scheduleDrawRef.current);
      }
      if (previewRef.current) {
        drawPreview(ctx, previewRef.current);
      }
    });
  }, []);

  useEffect(() => {
    scheduleDrawRef.current = scheduleDraw;
  });

  const setPanLocal = useCallback(
    (p: Point) => {
      panRef.current = clampPan(p, viewport.scale);
      viewport.pan = { ...panRef.current };
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${viewport.scale})`;
      }
      setPanAtom(panRef.current);
    },
    [setPanAtom]
  );

  useEffect(() => {
    if (pan.x !== viewport.pan.x || pan.y !== viewport.pan.y) {
      setPanLocal(pan);
    }
  }, [pan, setPanLocal]);

  const fitAndCenter = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    viewport.w = container.clientWidth;
    viewport.h = container.clientHeight;
    viewport.scale = fitScale(viewport.w, viewport.h);
    setPanLocal({
      x: (viewport.w - BOARD_W * viewport.scale) / 2,
      y: (viewport.h - BOARD_H * viewport.scale) / 2,
    });
  }, [setPanLocal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    fitAndCenter();
    const ro = new ResizeObserver(() => {
      viewport.w = container.clientWidth;
      viewport.h = container.clientHeight;
      viewport.scale = fitScale(viewport.w, viewport.h);
      setPanLocal(panRef.current);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitAndCenter, setPanLocal]);

  useEffect(() => {
    if (moves.length !== prevMovesLenRef.current + 1) {
      const ids = new Set(moves.map((m) => m.id));
      for (const id of imgCacheRef.current.keys()) {
        if (!ids.has(id)) imgCacheRef.current.delete(id);
      }
    }
    prevMovesLenRef.current = moves.length;
    scheduleDraw();
  }, [moves, scheduleDraw]);

  useEffect(() => {
    redoBusyRef.current = false;
  }, [redoStack]);

  useEffect(() => {
    boardCanvas.current = canvasRef.current;
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const id = window.setInterval(() => {
      const last = lastMouseRef.current;
      const sent = lastSentMouseRef.current;
      if (Math.abs(last.x - sent.x) + Math.abs(last.y - sent.y) > 2) {
        lastSentMouseRef.current = last;
        socket.emit("mouse_move", viewportToBoard(last));
      }
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  const boardFromEvent = useCallback((e: Point): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.x - rect.left) / viewport.scale,
      y: (e.y - rect.top) / viewport.scale,
    };
  }, []);

  const updatePreview = useCallback((st: StrokeState) => {
    const width = lineWidthRef.current;
    const color = lineColorRef.current;
    const fill = st.mode === "eraser" ? "#000000" : fillColorRef.current;
    const p0 = st.points[0];
    const p1 = st.points[st.points.length - 1];
    if (st.shape === "rect") {
      const w = Math.abs(p1.x - p0.x);
      const h = Math.abs(p1.y - p0.y);
      const size = st.shift ? Math.max(w, h) : 0;
      previewRef.current = {
        kind: "shape",
        shape: "rect",
        x: Math.min(p0.x, p1.x),
        y: Math.min(p0.y, p1.y),
        w: size || w,
        h: size || h,
        width,
        color,
        fill,
        mode: st.mode,
      };
      return;
    }
    if (st.shape === "circle") {
      const r = st.shift
        ? Math.hypot(p1.x - p0.x, p1.y - p0.y)
        : Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2;
      previewRef.current = {
        kind: "shape",
        shape: "circle",
        x: st.shift ? p0.x : (p0.x + p1.x) / 2,
        y: st.shift ? p0.y : (p0.y + p1.y) / 2,
        w: r,
        h: r,
        width,
        color,
        fill,
        mode: st.mode,
      };
      return;
    }
      previewRef.current = {
      kind: "path",
      points: st.points,
      width,
      color,
      mode: st.mode,
    };
  }, []);

  const commitStroke = useCallback(
    (st: StrokeState) => {
      const options = {
        lineWidth: lineWidthRef.current,
        lineColor: lineColorRef.current,
        fillColor: st.mode === "eraser" ? "#000000" : fillColorRef.current,
        shape: st.shape,
        mode: st.mode,
      };
      const socket = getSocket();
      let placed = false;
      if (st.shape === "rect") {
        const rect = rectFrom(st.points[0], st.points[st.points.length - 1]);
        const size = st.shift ? Math.max(rect.w, rect.h) : 0;
        if ((size || rect.w) > MIN_MOVE && (size || rect.h) > MIN_MOVE) {
          socket.emit("draw", {
            rect: { x: rect.x, y: rect.y, w: size || rect.w, h: size || rect.h },
            options,
          });
          placed = true;
        }
      } else if (st.shape === "circle") {
        const p0 = st.points[0];
        const p1 = st.points[st.points.length - 1];
        const r = st.shift
          ? Math.hypot(p1.x - p0.x, p1.y - p0.y)
          : Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2;
        if (r > MIN_MOVE) {
          socket.emit("draw", {
            circle: {
              x: st.shift ? p0.x : (p0.x + p1.x) / 2,
              y: st.shift ? p0.y : (p0.y + p1.y) / 2,
              r,
            },
            options,
          });
          placed = true;
        }
      } else if (st.points.length >= 2) {
        socket.emit("draw", {
          path: st.points,
          options: { ...options, shape: "line" },
        });
        placed = true;
      }
      if (placed) {
        place();
      }
      previewRef.current = null;
      if (!placed) {
        scheduleDraw();
      }
    },
    [place, scheduleDraw]
  );

  function handleImageFile(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 700;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/webp", 0.85);
      const placed = new Image();
      placed.onload = () => {
        const mouse = lastMouseRef.current;
        const board = viewportToBoard(mouse);
        setImageGhost({ img: placed, w, h, x: board.x - w / 2, y: board.y - h / 2 });
      };
      placed.src = dataUrl;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const commitImageGhost = useCallback(() => {
    const g = imageGhostRef.current;
    if (g) {
      getSocket().emit("draw", {
        img: { base64: g.img.src, x: g.x, y: g.y, w: g.w, h: g.h },
        options: {
          lineWidth: lineWidthRef.current,
          lineColor: lineColorRef.current,
          fillColor: fillColorRef.current,
          shape: "image",
          mode: "draw",
        },
      });
      place();
    }
    setImageGhost(null);
  }, [place]);

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
          return;
        }
      }
    }
  }

  const bboxOf = useCallback((move: Move): SelRect => {
    return moveBBox(move) ?? { x: 0, y: 0, w: 0, h: 0 };
  }, []);

  const snapshotSelection = useCallback((): { src: string; rect: SelRect } | null => {
    const ids = selectionRef.current;
    const selected = visibleMoves(movesRef.current).filter((m) => ids.includes(m.id));
    if (selected.length === 0) return null;
    const union = unionRect(selected, bboxOf);
    const rect = { x: union.x, y: union.y, w: union.w, h: union.h };
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(rect.w));
    c.height = Math.max(1, Math.ceil(rect.h));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.save();
    ctx.translate(-rect.x, -rect.y);
    for (const m of selected) {
      drawMove(ctx, m, imgCacheRef.current, scheduleDraw);
    }
    ctx.restore();
    return { src: c.toDataURL("image/png"), rect };
  }, [bboxOf, scheduleDraw]);

  const emitEraserRect = useCallback((rect: SelRect) => {
    getSocket().emit("draw", {
      rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      options: {
        lineWidth: 1,
        lineColor: "#000000",
        fillColor: "#000000",
        shape: "rect",
        mode: "eraser",
      },
    });
  }, []);

  const commitMoveGhost = useCallback(() => {
    const g = moveGhostRef.current;
    if (g) {
      getSocket().emit("draw", {
        img: { base64: g.src, x: g.x, y: g.y, w: g.w, h: g.h },
        options: {
          lineWidth: lineWidthRef.current,
          lineColor: lineColorRef.current,
          fillColor: fillColorRef.current,
          shape: "image",
          mode: "draw",
        },
      });
      setSelection([]);
      place();
    }
    setMoveGhost(null);
  }, [place, setSelection]);

  const cancelMoveGhost = useCallback(() => {
    const g = moveGhostRef.current;
    if (g) {
      const rest = { x: g.x - g.offX, y: g.y - g.offY };
      getSocket().emit("draw", {
        img: { base64: g.src, x: rest.x, y: rest.y, w: g.w, h: g.h },
        options: {
          lineWidth: lineWidthRef.current,
          lineColor: lineColorRef.current,
          fillColor: fillColorRef.current,
          shape: "image",
          mode: "draw",
        },
      });
    }
    setMoveGhost(null);
    setSelection([]);
  }, [setSelection]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button === 2) return;
      e.preventDefault();
      const client = { x: e.clientX, y: e.clientY };
      const board = boardFromEvent(client);
      lastMouseRef.current = client;
      lastBoardPoint.x = board.x;
      lastBoardPoint.y = board.y;

      if (moveGhostRef.current) {
        commitMoveGhost();
        return;
      }
      if (imageGhostRef.current) {
        commitImageGhost();
        return;
      }

      const tool = modeRef.current;
      if (tool === "pan" || e.ctrlKey || e.button === 1) {
        activeRef.current = { kind: "pan", startClient: client, startPan: { ...panRef.current } };
        setPanning(true);
        return;
      }
      if (tool === "select") {
        activeRef.current = { kind: "select", startBoard: board, endBoard: board };
        setSelRect({ x: board.x, y: board.y, w: 0, h: 0 });
        return;
      }
      if (shapeRef.current === "image" && tool !== "eraser") {
        return;
      }
      activeRef.current = {
        kind: "stroke",
        stroke: {
          start: board,
          points: [board],
          mode: tool === "eraser" ? "eraser" : "draw",
          shape: tool === "eraser" ? "line" : shapeRef.current,
          shift: e.shiftKey,
        },
      };
      previewRef.current = {
        kind: "path",
        points: [board],
        width: lineWidthRef.current,
        color: lineColorRef.current,
        mode: tool === "eraser" ? "eraser" : "draw",
      };
      scheduleDraw();
    },
    [boardFromEvent, commitImageGhost, commitMoveGhost, scheduleDraw]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const client = { x: e.clientX, y: e.clientY };
      lastMouseRef.current = client;
      const board = boardFromEvent(client);
      lastBoardPoint.x = board.x;
      lastBoardPoint.y = board.y;

      if (moveGhostRef.current) {
        setMoveGhost((g) => (g ? { ...g, x: board.x - g.offX, y: board.y - g.offY } : g));
        return;
      }
      if (imageGhostRef.current) {
        const g = imageGhostRef.current;
        setImageGhost({ ...g, x: board.x - g.w / 2, y: board.y - g.h / 2 });
        return;
      }

      const active = activeRef.current;
      if (!active) return;
      if (active.kind === "pan") {
        setPanLocal({
          x: active.startPan.x + (client.x - active.startClient.x),
          y: active.startPan.y + (client.y - active.startClient.y),
        });
        return;
      }
      if (active.kind === "select") {
        active.endBoard = board;
        setSelRect({
          x: Math.min(active.startBoard.x, board.x),
          y: Math.min(active.startBoard.y, board.y),
          w: Math.abs(board.x - active.startBoard.x),
          h: Math.abs(board.y - active.startBoard.y),
        });
        return;
      }
      if (active.kind === "stroke") {
        const st = active.stroke;
        const last = st.points[st.points.length - 1];
        if (st.shift && (st.shape === "rect" || st.shape === "circle" || st.shape === "line")) {
          if (st.shape === "line") {
            st.points = [st.start, board];
          }
        } else if (Math.hypot(board.x - last.x, board.y - last.y) >= MIN_MOVE) {
          st.points.push(board);
        }
        updatePreview(st);
        scheduleDraw();
      }
    };

    const onUp = () => {
      const active = activeRef.current;
      if (!active) return;
      if (active.kind === "pan") {
        setPanning(false);
      } else if (active.kind === "select") {
        const rect = rectFrom(active.startBoard, active.endBoard);
        if (rect.w > 2 && rect.h > 2) {
          const ids: string[] = [];
          for (const move of visibleMoves(movesRef.current)) {
            if (moveIntersects(move, rect)) {
              ids.push(move.id);
            }
          }
          setSelection(ids);
        } else {
          setSelection([]);
        }
        setSelRect(null);
        pop();
      } else if (active.kind === "stroke") {
        commitStroke(active.stroke);
      }
      activeRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [boardFromEvent, commitStroke, pop, scheduleDraw, setPanLocal, setSelection, updatePreview]);



  const copySelection = useCallback(() => {
    if (selectionRef.current.length === 0) return;
    const snap = snapshotSelection();
    if (!snap) return;
    const blob = dataUrlToBlob(snap.src);
    void navigator.clipboard
      .write([new ClipboardItem({ "image/png": blob })])
      .then(() => notify("Copied selection to clipboard"))
      .catch(() => notify("Couldn't copy to clipboard", "error"));
  }, [snapshotSelection]);

  useEffect(() => {
    if (!selectionAction) return;
    const action = selectionAction;
    setSelectionAction(null);
    const ids = selectionRef.current;
    if (ids.length === 0) return;
    const selected = movesRef.current.filter((m) => ids.includes(m.id));
    const union = unionRect(selected, bboxOf);
    const rect = { x: union.x, y: union.y, w: union.w, h: union.h };
    if (action.type === "delete") {
      emitEraserRect(rect);
      setSelection([]);
      pop();
      return;
    }
    const snap = snapshotSelection();
    if (!snap) return;
    if (action.type === "move") {
      const mouse = lastMouseRef.current;
      const board = viewportToBoard(mouse);
      emitEraserRect(rect);
      setMoveGhost({
        src: snap.src,
        x: board.x - snap.rect.w / 2,
        y: board.y - snap.rect.h / 2,
        w: snap.rect.w,
        h: snap.rect.h,
        offX: snap.rect.w / 2,
        offY: snap.rect.h / 2,
      });
      return;
    }
    if (action.type === "copy") {
      copySelection();
      return;
    }
  }, [bboxOf, copySelection, emitEraserRect, pop, selectionAction, setSelection, setSelectionAction, snapshotSelection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (myStackCountRef.current > 0) {
          getSocket().emit("undo");
          pop();
        }
        return;
      }
      if ((mod && e.key.toLowerCase() === "y") || (mod && e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        const last = redoRef.current[redoRef.current.length - 1];
        if (last && !redoBusyRef.current) {
          redoBusyRef.current = true;
          getSocket().emit("draw", last);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        copySelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionRef.current.length > 0) {
          const ids = selectionRef.current;
          const selected = movesRef.current.filter((m) => ids.includes(m.id));
          const union = unionRect(selected, bboxOf);
          emitEraserRect({
            x: union.x,
            y: union.y,
            w: union.w,
            h: union.h,
          });
          setSelection([]);
          pop();
        }
        return;
      }
      if (e.key === "Escape") {
        if (moveGhostRef.current) {
          cancelMoveGhost();
        } else if (imageGhostRef.current) {
          setImageGhost(null);
        } else if (selectionRef.current.length > 0) {
          setSelection([]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bboxOf, cancelMoveGhost, copySelection, emitEraserRect, pop, setSelection]);

  const ghostVp = moveGhost ? boardToViewport({ x: moveGhost.x, y: moveGhost.y }) : null;
  const imageGhostVp = imageGhost ? boardToViewport({ x: imageGhost.x, y: imageGhost.y }) : null;
  const selRectVp = selRect ? boardToViewport({ x: selRect.x, y: selRect.y }) : null;

  const selectionOutline = useMemo(() => {
    if (selection.length === 0) return null;
    const selected = visibleMoves(moves).filter((m) => selection.includes(m.id));
    if (selected.length === 0) return null;
    return unionRect(selected, bboxOf);
  }, [bboxOf, moves, selection]);

  const cursorUri = useMemo(() => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 22 22">` +
      `<path d="M2 2l14 4.5-5.6 2.2L8 15.8z" fill="${lineColor}" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>` +
      `</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 3, crosshair`;
  }, [lineColor]);

  const drawCursor = mode !== "select" && mode !== "pan" ? cursorUri : undefined;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#fafaf9] bg-[linear-gradient(rgba(24,24,27,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.08)_1px,transparent_1px)] bg-size-[50px_50px]"
      onPaste={onPaste}
    >
      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        className={`absolute left-0 top-0 origin-top-left touch-none ${
          mode === "select" || mode === "pan" ? "cursor-grab" : ""
        } ${panning ? "cursor-grabbing" : ""}`}
        style={{ width: BOARD_W, height: BOARD_H, willChange: "transform", cursor: drawCursor }}
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
      />

      {selRectVp && selRect && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-sky-500/80 bg-sky-400/10"
          style={{
            left: selRectVp.x,
            top: selRectVp.y,
            width: selRect.w * viewport.scale,
            height: selRect.h * viewport.scale,
          }}
        />
      )}

      {selectionOutline && selectionOutline.w > 0 && selectionOutline.h > 0 && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-sky-500/90 bg-sky-400/10"
          style={{
            left: selectionOutline.x * viewport.scale + viewport.pan.x,
            top: selectionOutline.y * viewport.scale + viewport.pan.y,
            width: selectionOutline.w * viewport.scale,
            height: selectionOutline.h * viewport.scale,
          }}
        />
      )}

      {!moveGhost && !imageGhost && selectionOutline && selectionOutline.w > 0 && (
        <div
          className="absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1.5 py-1 shadow-lg"
          style={{
            left:
              (selectionOutline.x + selectionOutline.w / 2) * viewport.scale + viewport.pan.x,
            top:
              selectionOutline.y * viewport.scale + viewport.pan.y - 48 < 8
                ? selectionOutline.y * viewport.scale +
                  viewport.pan.y +
                  selectionOutline.h * viewport.scale +
                  8
                : selectionOutline.y * viewport.scale + viewport.pan.y - 48,
          }}
        >
          <span className="px-1 text-[10px] font-bold text-zinc-500">
            {visibleMoves(moves).filter((m) => selection.includes(m.id)).length}
          </span>
          <button
            onClick={() => setSelectionAction({ id: Date.now(), type: "move" })}
            title="Move selection"
            className="rounded-full p-1.5 text-zinc-600 hover:bg-violet-100 hover:text-violet-700"
          >
            <MoveIcon size={14} />
          </button>
          <button
            onClick={copySelection}
            title="Copy as image"
            className="rounded-full p-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setSelectionAction({ id: Date.now(), type: "delete" })}
            title="Delete"
            className="rounded-full p-1.5 text-zinc-600 hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {ghostVp && moveGhost && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={moveGhost.src}
          alt=""
          className="pointer-events-none absolute z-20 rounded-sm shadow-2xl ring-2 ring-violet-500"
          style={{
            left: ghostVp.x,
            top: ghostVp.y,
            width: moveGhost.w * viewport.scale,
            height: moveGhost.h * viewport.scale,
          }}
        />
      )}

      {imageGhostVp && imageGhost && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageGhost.img.src}
          alt=""
          className="pointer-events-none absolute z-20 opacity-70"
          style={{
            left: imageGhostVp.x,
            top: imageGhostVp.y,
            width: imageGhost.w * viewport.scale,
            height: imageGhost.h * viewport.scale,
          }}
        />
      )}

      {moveGhost && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-white shadow-xl">
          Click to place · Esc to cancel
        </div>
      )}
    </div>
  );
}

function rectFrom(a: Point, b: Point): SelRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

function unionRect(moves: Move[], bboxOf: (m: Move) => SelRect): SelRect {
  if (moves.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of moves) {
    const b = bboxOf(m);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(parts[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

function moveBBox(move: Move): SelRect | null {
  const pad = move.options.shape === "image" ? 0 : Math.max(0, move.options.lineWidth) / 2 + 1;
  if (move.rect) {
    return { x: move.rect.x - pad, y: move.rect.y - pad, w: move.rect.w + pad * 2, h: move.rect.h + pad * 2 };
  }
  if (move.circle) {
    return {
      x: move.circle.x - move.circle.r - pad,
      y: move.circle.y - move.circle.r - pad,
      w: move.circle.r * 2 + pad * 2,
      h: move.circle.r * 2 + pad * 2,
    };
  }
  if (move.img) {
    return { x: move.img.x, y: move.img.y, w: move.img.w, h: move.img.h };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of move.path ?? []) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return null;
  const strokePad = Math.max(0, move.options.lineWidth) / 2 + 1;
  return { x: minX - strokePad, y: minY - strokePad, w: maxX - minX + strokePad * 2, h: maxY - minY + strokePad * 2 };
}

function segDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2;
}

function moveFullyErased(move: Move, erasers: PathEraser[]): boolean {
  const samples: Point[] = [];
  if (move.path) {
    samples.push(...move.path);
  } else if (move.rect) {
    const { x, y, w, h } = move.rect;
    const mx = x + w / 2;
    const my = y + h / 2;
    samples.push({ x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h });
    samples.push({ x: mx, y }, { x: mx, y: y + h }, { x, y: my }, { x: x + w, y: my });
  } else if (move.circle) {
    const { x, y, r } = move.circle;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      samples.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
    }
  } else if (move.img) {
    const { x, y, w, h } = move.img;
    samples.push({ x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h });
  }
  for (const s of samples) {
    let covered = false;
    for (const e of erasers) {
      const half = e.width / 2;
      if (s.x < e.minX - half || s.x > e.maxX + half || s.y < e.minY - half || s.y > e.maxY + half) {
        continue;
      }
      const marginSq = half ** 2;
      for (let i = 1; i < e.path.length; i++) {
        if (
          segDistSq(s.x, s.y, e.path[i - 1].x, e.path[i - 1].y, e.path[i].x, e.path[i].y) <= marginSq
        ) {
          covered = true;
          break;
        }
      }
      if (covered) break;
    }
    if (!covered) return false;
  }
  return samples.length > 0;
}

interface PathEraser {
  path: Point[];
  width: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function visibleMoves(moves: Move[]): Move[] {
  const rectErasers: SelRect[] = [];
  const pathErasers: PathEraser[] = [];
  const out: Move[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    if (m.options.mode === "eraser") {
      if (m.rect) {
        rectErasers.push(m.rect);
      } else if (m.path && m.path.length >= 2) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of m.path) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        pathErasers.push({
          path: m.path,
          width: Math.max(12, m.options.lineWidth * 3),
          minX,
          minY,
          maxX,
          maxY,
        });
      }
      continue;
    }
    const b = moveBBox(m);
    if (!b) continue;
    let hidden = rectErasers.some(
      (r) => b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h
    );
    if (!hidden) {
      hidden = pathErasers.length > 0 && moveFullyErased(m, pathErasers);
    }
    if (!hidden) out.unshift(m);
  }
  return out;
}

function moveIntersects(
  move: Move,
  rect: { x: number; y: number; w: number; h: number }
): boolean {
  const b = moveBBox(move);
  if (!b) return false;
  return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
}

function drawMove(
  ctx: CanvasRenderingContext2D,
  move: Move,
  imgCache: Map<string, HTMLImageElement>,
  onImageLoad: () => void
): void {
  const o = move.options;
  ctx.save();
  if (o.mode === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }
  if (o.shape === "image" && move.img) {
    let img = imgCache.get(move.id);
    if (!img) {
      img = new Image();
      img.onload = onImageLoad;
      img.src = move.img.base64;
      imgCache.set(move.id, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, move.img.x, move.img.y, move.img.w, move.img.h);
    }
  } else {
    ctx.lineWidth = o.mode === "eraser" ? Math.max(12, o.lineWidth * 3) : o.lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = o.lineColor;
    ctx.fillStyle = o.fillColor;
    if (o.shape === "rect" && move.rect) {
      if (o.fillColor !== "rgba(0,0,0,0)") {
        ctx.fillRect(move.rect.x, move.rect.y, move.rect.w, move.rect.h);
      }
      ctx.strokeRect(move.rect.x, move.rect.y, move.rect.w, move.rect.h);
    } else if (o.shape === "circle" && move.circle) {
      ctx.beginPath();
      ctx.arc(move.circle.x, move.circle.y, move.circle.r, 0, Math.PI * 2);
      if (o.fillColor !== "rgba(0,0,0,0)") {
        ctx.fill();
      }
      ctx.stroke();
    } else {
      const path = move.path;
      if (path && path.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawPreview(ctx: CanvasRenderingContext2D, preview: Preview): void {
  if (!preview) return;
  ctx.save();
  if (preview.kind === "path") {
    if (preview.mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.lineWidth = preview.mode === "eraser" ? Math.max(12, preview.width * 3) : preview.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = preview.color;
    ctx.beginPath();
    ctx.moveTo(preview.points[0].x, preview.points[0].y);
    for (let i = 1; i < preview.points.length; i++) {
      ctx.lineTo(preview.points[i].x, preview.points[i].y);
    }
    ctx.stroke();
  } else if (preview.kind === "shape") {
    if (preview.mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.lineWidth = preview.width;
    ctx.strokeStyle = preview.color;
    ctx.fillStyle = preview.fill;
    if (preview.shape === "rect") {
      if (preview.fill !== "rgba(0,0,0,0)") {
        ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
      }
      ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
    } else {
      ctx.beginPath();
      ctx.ellipse(preview.x, preview.y, preview.w, preview.h, 0, 0, Math.PI * 2);
      if (preview.fill !== "rgba(0,0,0,0)") {
        ctx.fill();
      }
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(preview.img, preview.x, preview.y, preview.w, preview.h);
  }
  ctx.restore();
}
