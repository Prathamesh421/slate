"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";
import { modalAtom, userNameAtom } from "@/atoms/room";
import { getSocket, disconnectSocket } from "@/modules/socket";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useAtom(userNameAtom);
  const [joinId, setJoinId] = useState("");
  const setModal = useAtom(modalAtom)[1];

  useEffect(() => {
    disconnectSocket();
  }, []);

  const createRoom = () => {
    if (!name.trim()) return;
    const socket = getSocket();
    socket.emit("create_room", name);
  };

  const joinRoom = () => {
    if (!name.trim() || !joinId.trim()) return;
    const socket = getSocket();
    socket.emit("join_room", joinId.trim().toUpperCase(), name);
  };

  useEffect(() => {
    const socket = getSocket();
    const onCreated = (roomId: string) => {
      router.push(`/${roomId}`);
    };
    const onJoined = (payload: { roomId: string; color: string } | null) => {
      if (!payload) {
        setModal({ kind: "joinFail" });
        return;
      }
      router.push(`/${payload.roomId}`);
    };
    socket.on("created", onCreated);
    socket.on("joined", onJoined);
    return () => {
      socket.off("created", onCreated);
      socket.off("joined", onJoined);
    };
  }, [router, setModal]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-violet-100 via-zinc-50 to-amber-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg">
            <Palette size={24} strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Slate</h1>
            <p className="text-xs text-zinc-500">Draw together. Live.</p>
          </div>
        </div>

        <label className="mt-8 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your name
        </label>
        <input
          value={name}
          maxLength={15}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ada"
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />

        <button
          onClick={createRoom}
          disabled={!name.trim()}
          className="mt-6 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-40"
        >
          Create a room
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200" />
          or join
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinId}
            maxLength={5}
            onChange={(e) => setJoinId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="ROOM ID"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm uppercase tracking-[0.2em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
          <button
            onClick={joinRoom}
            disabled={!name.trim() || !joinId.trim()}
            className="shrink-0 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>
    </main>
  );
}
