"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useAtom, useAtomValue } from "jotai";
import { chatAtom, chatOpenAtom, chatUnreadAtom, userNameAtom } from "@/atoms/room";
import { getSocket } from "@/modules/socket";

export function Chat() {
  const [open, setOpen] = useAtom(chatOpenAtom);
  const [unread, setUnread] = useAtom(chatUnreadAtom);
  const messages = useAtomValue(chatAtom);
  const name = useAtomValue(userNameAtom);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      setUnread(0);
    }
  }, [messages, open, setUnread]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("send_msg", text);
    setDraft("");
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-xl transition hover:bg-white"
        >
          <MessageCircle size={16} className="text-violet-600" /> Chat
          {unread > 0 && (
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">
              New! {unread}
            </span>
          )}
        </button>
      )}
      {open && (
        <div className="flex h-72 w-96 flex-col overflow-hidden rounded-2xl border border-zinc-300/70 bg-white/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <span className="text-sm font-bold text-zinc-800">Room chat</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X size={14} />
            </button>
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-zinc-400">No messages yet. Say hi!</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="font-bold" style={{ color: m.color }}>
                  {m.name}
                </span>
                <span className="text-zinc-400">: </span>
                <span className="break-words text-zinc-700">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-zinc-200 p-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={`Message as ${name || "you"}…`}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-violet-500"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Send size={13} strokeWidth={2.4} /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
