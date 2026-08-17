"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAtom, useSetAtom, useStore } from "jotai";
import {
  chatAtom,
  chatOpenAtom,
  chatUnreadAtom,
  cursorsAtom,
  emoteBurstsAtom,
  modalAtom,
  movesAtom,
  myIdAtom,
  myMovesStackAtom,
  redoStackAtom,
  userMoveCountsAtom,
  usersAtom,
  userNameAtom,
} from "@/atoms/room";
import type { ChatMessage, EmoteType, Move, Point, RoomState, UserInfo } from "@/common/types";
import { getSocket, disconnectSocket } from "@/modules/socket";
import { notify } from "@/modules/notify";
import { useSound } from "@/modules/sound";
import { Board } from "@/components/Board";
import { Chat } from "@/components/Chat";
import { Cursors } from "@/components/Cursors";
import { Toolbar } from "@/components/Toolbar";
import { UserList } from "@/components/UserList";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId ?? "").toUpperCase();
  const store = useStore();

  const [name] = useAtom(userNameAtom);
  const [modal, setModal] = useAtom(modalAtom);
  const setMyId = useSetAtom(myIdAtom);
  const setMoves = useSetAtom(movesAtom);
  const setUsers = useSetAtom(usersAtom);
  const setUserMoveCounts = useSetAtom(userMoveCountsAtom);
  const setMyStack = useSetAtom(myMovesStackAtom);
  const setRedoStack = useSetAtom(redoStackAtom);
  const setCursors = useSetAtom(cursorsAtom);
  const setChat = useSetAtom(chatAtom);
  const setChatUnread = useSetAtom(chatUnreadAtom);
  const setEmoteBursts = useSetAtom(emoteBurstsAtom);

  const perUserRef = useRef(new Map<string, Move[]>());
  const joinedRef = useRef(false);
  const [phase, setPhase] = useState<"gating" | "joinFail" | "ready">("gating");
  const { chime } = useSound();

  useEffect(() => {
    if (!name.trim()) {
      setModal((prev) => (prev?.kind === "nameGate" ? prev : { kind: "nameGate" }));
      return;
    }
    if (modal?.kind === "nameGate") {
      setModal(null);
    }
  }, [name, modal, setModal]);

  useEffect(() => {
    if (phase !== "gating" || modal !== null || !name.trim()) return;
    const socket = getSocket();
    socket.emit("check_room", roomId);
    const onExists = (exists: boolean) => {
      if (!exists) {
        setModal({ kind: "notFound" });
        return;
      }
      socket.emit("join_room", roomId, name);
    };
    const onJoined = (payload: { roomId: string; color: string } | null) => {
      if (!payload) {
        setModal({ kind: "joinFail" });
        setPhase("joinFail");
        return;
      }
      setMyId(socket.id ?? "");
    };
    socket.on("room_exists", onExists);
    socket.on("joined", onJoined);
    return () => {
      socket.off("room_exists", onExists);
      socket.off("joined", onJoined);
    };
  }, [modal, name, phase, roomId, setModal, setMyId]);

  useEffect(() => {
    const socket = getSocket();
    const perUser = perUserRef.current;

    const onRoom = (state: RoomState) => {
      perUser.clear();
      const moves: Move[] = [];
      for (const entry of state.moves) {
        moves.push(entry.move);
        const arr = perUser.get(entry.userId);
        if (arr) {
          arr.push(entry.move);
        } else {
          perUser.set(entry.userId, [entry.move]);
        }
      }
      setMoves(moves);
      setUserMoveCounts(state.userMoveCounts);
      setUsers(state.users);
      setChat([]);
      joinedRef.current = true;
      const me = socket.id ?? "";
      setMyStack(perUser.get(me) ?? []);
      setRedoStack([]);
      setPhase("ready");
      chime();
    };

    const onYourMove = (move: Move) => {
      setMoves((prev) => [...prev, move]);
      setMyStack((prev) => [...prev, move]);
      setRedoStack([]);
      const me = socket.id ?? "";
      perUser.set(me, [...(perUser.get(me) ?? []), move]);
      setUserMoveCounts((prev) => ({ ...prev, [me]: (prev[me] ?? 0) + 1 }));
    };

    const onUserDraw = (payload: { userId: string; move: Move }) => {
      setMoves((prev) => [...prev, payload.move]);
      const arr = perUser.get(payload.userId) ?? [];
      arr.push(payload.move);
      perUser.set(payload.userId, arr);
      setUserMoveCounts((prev) => ({
        ...prev,
        [payload.userId]: (prev[payload.userId] ?? 0) + 1,
      }));
    };

    const onUserUndo = (userId: string) => {
      const arr = perUser.get(userId);
      const popped = arr?.pop();
      if (popped) {
        setMoves((prev) => {
          const idx = prev.findIndex((m) => m.id === popped.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        });
        setUserMoveCounts((prev) => ({
          ...prev,
          [userId]: Math.max(0, (prev[userId] ?? 1) - 1),
        }));
      }
      if (userId === socket.id) {
        if (popped) {
          setRedoStack((prev) => [...prev, popped]);
        }
        setMyStack((prev) => prev.slice(0, -1));
      }
    };

    const onNewUser = (user: UserInfo) => {
      setUsers((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    };

    const onUserDisconnected = (userId: string) => {
      const left = store.get(usersAtom).find((u) => u.id === userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (left && userId !== socket.id) {
        notify(`${left.name} left`, "info");
      }
      setCursors((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      perUser.delete(userId);
      setUserMoveCounts((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const onMouseMoved = (payload: { userId: string; pos: Point }) => {
      const user = store.get(usersAtom).find((u) => u.id === payload.userId);
      if (!user) return;
      setCursors((prev) => ({
        ...prev,
        [payload.userId]: {
          pos: payload.pos,
          name: user.name,
          color: user.color,
        },
      }));
    };

    const onNewMsg = (msg: ChatMessage) => {
      setChat((prev) => [...prev, msg]);
      if (!store.get(chatOpenAtom)) {
        setChatUnread((prev) => prev + 1);
      }
    };

    const onEmote = (payload: { userId: string; type: EmoteType; x: number; y: number }) => {
      setEmoteBursts((prev) => [
        ...prev,
        { ...payload, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ]);
    };

    socket.on("room", onRoom);
    socket.on("your_move", onYourMove);
    socket.on("user_draw", onUserDraw);
    socket.on("user_undo", onUserUndo);
    socket.on("new_user", onNewUser);
    socket.on("user_disconnected", onUserDisconnected);
    socket.on("mouse_moved", onMouseMoved);
    socket.on("new_msg", onNewMsg);
    socket.on("emote", onEmote);
    return () => {
      socket.off("room", onRoom);
      socket.off("your_move", onYourMove);
      socket.off("user_draw", onUserDraw);
      socket.off("user_undo", onUserUndo);
      socket.off("new_user", onNewUser);
      socket.off("user_disconnected", onUserDisconnected);
      socket.off("mouse_moved", onMouseMoved);
      socket.off("new_msg", onNewMsg);
      socket.off("emote", onEmote);
    };
  }, [
    chime,
    setChat,
    setChatUnread,
    setCursors,
    setEmoteBursts,
    setMoves,
    setMyStack,
    setRedoStack,
    setUserMoveCounts,
    setUsers,
    store,
  ]);

  useEffect(() => {
    if (phase !== "ready") return;
    const socket = getSocket();
    const onConnect = () => {
      socket.emit("check_room", roomId);
      const onExists = (exists: boolean) => {
        if (!exists) {
          setModal({ kind: "notFound" });
          return;
        }
        const onJoined = (payload: { roomId: string; color: string } | null) => {
          if (!payload) {
            setModal({ kind: "joinFail" });
            setPhase("joinFail");
            return;
          }
          setMyId(socket.id ?? "");
        };
        socket.once("joined", onJoined);
        socket.emit("join_room", roomId, name);
      };
      socket.once("room_exists", onExists);
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [name, phase, roomId, setModal, setMyId, setPhase]);

  useEffect(() => {
    return () => {
      if (!joinedRef.current) return;
      getSocket().emit("leave_room");
      disconnectSocket();
    };
  }, []);

  if (phase !== "ready") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-sm font-semibold text-zinc-500">
          {modal ? "Waiting for you…" : "Joining room…"}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Board />
      <Cursors />
      <Toolbar />
      <UserList />
      <Chat />
    </div>
  );
}
