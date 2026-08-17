"use client";

import { useRef, useState } from "react";
import { HexColorPicker, RgbColorPicker } from "react-colorful";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BoxSelect,
  ChevronLeft,
  Circle,
  Download,
  Eraser,
  Hand,
  Image as ImageIcon,
  Link2,
  LogOut,
  Palette,
  Pencil,
  PenTool,
  Redo2,
  Square,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  fillColorAtom,
  lineColorAtom,
  lineWidthAtom,
  modeAtom,
  movesAtom,
  mutedAtom,
  myIdAtom,
  myMovesStackAtom,
  pendingImageAtom,
  redoStackAtom,
  shapeAtom,
  toolbarOpenAtom,
  userMoveCountsAtom,
  usersAtom,
} from "@/atoms/room";
import type { EmoteType, Shape, ToolMode } from "@/common/types";
import { EMOTE_ICONS, GRID_SIZE } from "@/common/colors";
import { boardCanvas, lastBoardPoint } from "@/modules/boardRef";
import { notify } from "@/modules/notify";
import { getSocket } from "@/modules/socket";
import { BOARD_H, BOARD_W } from "@/modules/viewport";

const SHAPES: { id: Shape; label: string; icon: LucideIcon }[] = [
  { id: "line", label: "Pen", icon: Pencil },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Ellipse", icon: Circle },
  { id: "image", label: "Image", icon: ImageIcon },
];

const MODES: { id: ToolMode; label: string; icon: LucideIcon }[] = [
  { id: "draw", label: "Draw", icon: PenTool },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "select", label: "Select", icon: BoxSelect },
  { id: "pan", label: "Pan", icon: Hand },
];

const EMOTES: { id: EmoteType; icon: string }[] = (
  Object.keys(EMOTE_ICONS) as EmoteType[]
).map((id) => ({ id, icon: EMOTE_ICONS[id] }));

export function Toolbar() {
  const router = useRouter();
  const [open, setOpen] = useAtom(toolbarOpenAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [shape, setShape] = useAtom(shapeAtom);
  const [lineColor, setLineColor] = useAtom(lineColorAtom);
  const [fillColor, setFillColor] = useAtom(fillColorAtom);
  const [lineWidth, setLineWidth] = useAtom(lineWidthAtom);
  const [muted, setMuted] = useAtom(mutedAtom);
  const setPendingImage = useSetAtom(pendingImageAtom);
  const users = useAtomValue(usersAtom);
  const userMoveCounts = useAtomValue(userMoveCountsAtom);
  const myId = useAtomValue(myIdAtom);
  const myStack = useAtomValue(myMovesStackAtom);
  const redoStack = useAtomValue(redoStackAtom);
  const moves = useAtomValue(movesAtom);

  const [showLinePicker, setShowLinePicker] = useState(false);
  const [showFillPicker, setShowFillPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickShape = (s: Shape) => {
    setShape(s);
    setMode("draw");
    if (s === "image") {
      fileInputRef.current?.click();
    }
  };

  const undo = () => {
    if (myStack.length === 0) return;
    getSocket().emit("undo");
  };

  const redo = () => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;
    getSocket().emit("draw", last);
  };

  const share = () => {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => notify("Room link copied to clipboard", "success"))
      .catch(() => notify("Couldn't copy link", "error"));
  };

  const download = () => {
    const canvas = boardCanvas.current;
    if (!canvas) return;
    const c = document.createElement("canvas");
    c.width = BOARD_W;
    c.height = BOARD_H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.strokeStyle = "rgba(24,24,27,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GRID_SIZE; x < BOARD_W; x += GRID_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BOARD_H);
    }
    for (let y = GRID_SIZE; y < BOARD_H; y += GRID_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(BOARD_W, y);
    }
    ctx.stroke();
    ctx.drawImage(canvas, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slate-${window.location.pathname.slice(1) || "board"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Downloaded board as PNG", "success");
    }, "image/png");
  };

  const exit = () => {
    getSocket().emit("leave_room");
    router.push("/");
  };

  const emote = (type: EmoteType) => {
    const pos = lastBoardPoint.x >= 0 ? lastBoardPoint : { x: BOARD_W / 2, y: BOARD_H / 2 };
    getSocket().emit("emote", { type, x: pos.x, y: pos.y });
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -290, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -290, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="absolute left-4 top-4 bottom-4 z-20 flex w-64 flex-col overflow-y-auto rounded-2xl border border-zinc-300/70 bg-white/95 p-4 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <h1 className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-zinc-900">
                <Palette size={18} strokeWidth={2.4} className="text-violet-600" /> Slate
              </h1>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
                title="Collapse toolbar"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            <Section title="History">
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={myStack.length === 0}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  <Undo2 size={13} strokeWidth={2.4} /> Undo
                </button>
                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  <Redo2 size={13} strokeWidth={2.4} /> Redo
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {users.length === 0 && <p className="text-[11px] text-zinc-400">No users yet</p>}
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: u.color }}
                    />
                    <span className="flex-1 truncate font-medium text-zinc-700">
                      {u.name}
                      {u.id === myId ? " (you)" : ""}
                    </span>
                    <span className="font-semibold text-zinc-500">{userMoveCounts[u.id] ?? 0}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">{moves.length} moves on board</p>
            </Section>

            <Section title="Shapes">
              <div className="grid grid-cols-5 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pickShape(s.id)}
                    title={s.label}
                    className={`flex aspect-square items-center justify-center rounded-lg text-lg transition ${
                      shape === s.id && mode === "draw"
                        ? "bg-violet-600 text-white shadow"
                        : "bg-zinc-100 hover:bg-zinc-200"
                    }`}
                  >
                    {s.icon && <s.icon size={18} strokeWidth={2.2} />}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Mode">
              <div className="grid grid-cols-4 gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    title={m.label}
                    className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-lg transition ${
                      mode === m.id ? "bg-violet-600 text-white shadow" : "bg-zinc-100 hover:bg-zinc-200"
                    }`}
                  >
                    {m.icon && <m.icon size={16} strokeWidth={2.2} />}
                    <span className="text-[9px] font-semibold">{m.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Colors">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLinePicker((v) => !v)}
                  className="h-8 w-10 rounded-lg border-2 border-zinc-300 shadow-inner"
                  style={{ backgroundColor: lineColor }}
                  title="Line color"
                />
                <div className="text-[10px] leading-tight text-zinc-500">
                  Line
                  <br />
                  stroke
                </div>
                <div className="mx-1 h-6 w-px bg-zinc-200" />
                <button
                  onClick={() => setShowFillPicker((v) => !v)}
                  className="h-8 w-10 rounded-lg border-2 border-zinc-300 shadow-inner"
                  style={{
                    backgroundColor: fillColor,
                    backgroundImage:
                      fillColor === "rgba(0,0,0,0)"
                        ? "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%)"
                        : "none",
                    backgroundSize: "10px 10px",
                  }}
                  title="Fill color"
                />
                <div className="text-[10px] leading-tight text-zinc-500">
                  Fill
                  <br />
                  color
                </div>
              </div>
              {showLinePicker && (
                <div className="relative mt-2">
                  <HexColorPicker color={lineColor} onChange={setLineColor} />
                  <input
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                    className="mt-2 w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                </div>
              )}
              {showFillPicker && (
                <div className="relative mt-2">
                  <RgbColorPicker
                    color={rgbaToColor(fillColor)}
                    onChange={(c) => setFillColor(`rgba(${c.r},${c.g},${c.b},1)`)}
                  />
                  <button
                    onClick={() => setFillColor("rgba(0,0,0,0)")}
                    className="mt-2 w-full rounded border border-zinc-300 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    Clear fill
                  </button>
                </div>
              )}
            </Section>

            <Section title="Width">
              <input
                type="range"
                min={1}
                max={20}
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                disabled={mode === "select"}
                className="w-full accent-violet-600 disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>1</span>
                <span className="font-bold text-zinc-700">{lineWidth}px</span>
                <span>20</span>
              </div>
            </Section>

            <Section title="Actions">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={share}
                  className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  <Link2 size={13} strokeWidth={2.4} /> Share
                </button>
                <button
                  onClick={download}
                  className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  <Download size={13} strokeWidth={2.4} /> Download
                </button>
                <button
                  onClick={exit}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <LogOut size={13} strokeWidth={2.4} /> Exit
                </button>
              </div>
            </Section>

            <Section title="Fun">
              <div className="flex gap-1.5">
                {EMOTES.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => emote(e.id)}
                    className="flex-1 rounded-lg bg-zinc-100 py-1.5 text-base transition hover:scale-110 hover:bg-zinc-200"
                    title={`Send ${e.id}`}
                  >
                    {e.icon}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setMuted(!muted)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                    muted ? "bg-zinc-100 text-zinc-500 hover:bg-zinc-200" : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                  }`}
                >
                  {muted ? (
                    <>
                      <VolumeX size={13} strokeWidth={2.4} /> Sound off
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} strokeWidth={2.4} /> Sound on
                    </>
                  )}
                </button>
              </div>
            </Section>
          </motion.aside>
        )}
      </AnimatePresence>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-300/70 bg-white/95 text-lg shadow-xl transition hover:bg-white"
          title="Open toolbar"
        >
          <Palette size={20} strokeWidth={2.2} className="text-violet-600" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPendingImage(file);
          }
          e.target.value = "";
        }}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-2">
      <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{title}</h2>
      {children}
    </div>
  );
}

function rgbaToColor(rgba: string): { r: number; g: number; b: number; a: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] ? Number(m[4]) : 1 };
}
