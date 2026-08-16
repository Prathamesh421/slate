"use client";

import { useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { motion } from "motion/react";
import { chatAtom, cursorsAtom, emoteBurstsAtom, myIdAtom } from "@/atoms/room";
import { EMOTE_ICONS } from "@/common/colors";
import type { Point } from "@/common/types";
import { boardToViewport } from "@/modules/viewport";

const LERP = 0.25;
const EMOTE_LIFETIME = 3200;

export function Cursors() {
  const cursors = useAtomValue(cursorsAtom);
  const myId = useAtomValue(myIdAtom);
  const emoteBursts = useAtomValue(emoteBurstsAtom);
  const setEmoteBursts = useSetAtom(emoteBurstsAtom);
  const chat = useAtomValue(chatAtom);

  const posRef = useRef<Record<string, Point>>({});
  const prevRef = useRef<Record<string, Point>>({});
  const cursorsRef = useRef(cursors);
  const myIdRef = useRef(myId);
  const chatRef = useRef(chat);

  useEffect(() => {
    cursorsRef.current = cursors;
    myIdRef.current = myId;
    chatRef.current = chat;
  }, [chat, cursors, myId]);

  const [eased, setEased] = useState<Record<string, Point>>({});
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const targets = cursorsRef.current;
      const next: Record<string, Point> = {};
      let changed = false;
      for (const [id, info] of Object.entries(targets)) {
        if (id === myIdRef.current) continue;
        const cur = posRef.current[id];
        const target = info.pos;
        if (!cur) {
          posRef.current[id] = { x: target.x, y: target.y };
          prevRef.current[id] = { x: target.x, y: target.y };
          next[id] = { x: target.x, y: target.y };
          changed = true;
          continue;
        }
        const nx = cur.x + (target.x - cur.x) * LERP;
        const ny = cur.y + (target.y - cur.y) * LERP;
        posRef.current[id] = { x: nx, y: ny };
        next[id] = { x: nx, y: ny };
        const dist = Math.hypot(nx - prevRef.current[id].x, ny - prevRef.current[id].y);
        prevRef.current[id] = { x: nx, y: ny };
        changed = changed || dist > 0.2;
      }
      for (const id of Object.keys(posRef.current)) {
        if (!targets[id] || id === myIdRef.current) {
          delete posRef.current[id];
          delete prevRef.current[id];
          changed = true;
        }
      }
      if (changed) {
        setEased(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      setBubbles((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, b] of Object.entries(next)) {
          if (b.until <= now) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    cleanup();
    const id = window.setInterval(cleanup, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const messages = chatRef.current;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    setBubbles((prev) => ({
      ...prev,
      [`${last.name}|${last.color}`]: { text: last.text, until: Date.now() + 3000 },
    }));
  }, [chat]);

  useEffect(() => {
    if (emoteBursts.length === 0) return;
    const t = window.setTimeout(() => setEmoteBursts([]), EMOTE_LIFETIME);
    return () => window.clearTimeout(t);
  }, [emoteBursts, setEmoteBursts]);

  const remoteIds = Object.keys(cursors).filter((id) => id !== myId);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {remoteIds.map((id) => {
        const info = cursors[id];
        const pos = eased[id] ?? info.pos;
        const vp = boardToViewport(pos);
        const bubble = bubbles[`${info.name}|${info.color}`];
        return (
          <div key={id} className="absolute" style={{ left: vp.x, top: vp.y }}>
            <svg width="22" height="22" viewBox="0 0 22 22" className="drop-shadow">
              <path
                d="M2 2l14 4.5-5.6 2.2L8 15.8z"
                fill={info.color}
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute left-4 top-4 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow"
              style={{ backgroundColor: info.color, whiteSpace: "nowrap" }}
            >
              {info.name}
            </span>
            {bubble && (
              <span
                className="absolute left-1 top-9 max-w-44 rounded-xl rounded-tl-sm bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-800 shadow-lg"
                style={{ whiteSpace: "nowrap" }}
              >
                {bubble.text}
              </span>
            )}
          </div>
        );
      })}

      {emoteBursts.map((burst) => {
        const xoff = (burst.id.charCodeAt(burst.id.length - 1) % 5) * 56 - 112;
        const tilt = ((burst.id.charCodeAt(burst.id.length - 1) % 3) - 1) * 3;
        return (
          <motion.div
            key={burst.id}
            initial={{ y: 0, opacity: 0, scale: 0.5, rotate: 0 }}
            animate={{ y: -170, opacity: [0, 1, 1, 0], scale: 1.5, rotate: tilt }}
            transition={{ duration: 3, times: [0, 0.12, 0.72, 1], ease: "easeOut" }}
            className="absolute bottom-32 z-30 select-none text-5xl drop-shadow-lg"
            style={{ left: `calc(50% + ${xoff}px)` }}
          >
            {EMOTE_ICONS[burst.type]}
          </motion.div>
        );
      })}
    </div>
  );
}
