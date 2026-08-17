import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import next from "next";
import { Server, type Socket } from "socket.io";
import type {
  ClientToServerEvents,
  DrawPayload,
  Move,
  RoomState,
  ServerToClientEvents,
  UserInfo,
} from "../src/common/types";
import { COLORS_ARRAY } from "../src/common/colors";

const PORT = Number(process.env.PORT || 3000);
const DEV = process.env.NODE_ENV !== "production";
const MAX_USERS = 12;

interface RoomUser {
  name: string;
  color: string;
}

interface Room {
  usersMoves: Map<string, Move[]>;
  drawed: { userId: string; move: Move }[];
  users: Map<string, RoomUser>;
}

const rooms = new Map<string, Room>();
const roomOf = new Map<string, string>();

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function createRoomId(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let id = "";
  do {
    id = "";
    for (let i = 0; i < 5; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(id));
  return id;
}

function serializeRoom(room: Room): RoomState {
  const userMoveCounts: Record<string, number> = {};
  for (const [id, moves] of room.usersMoves) {
    userMoveCounts[id] = moves.length;
  }
  return {
    moves: room.drawed,
    users: [...room.users.entries()].map(
      ([id, u]): UserInfo => ({ id, name: u.name, color: u.color })
    ),
    userMoveCounts,
  };
}

function joinRoom(io: TypedServer, socket: TypedSocket, roomId: string, name: string): UserInfo | null {
  const room = rooms.get(roomId);
  if (!room || room.users.size >= MAX_USERS) return null;
  const color = COLORS_ARRAY[room.users.size % COLORS_ARRAY.length];
  const user: UserInfo = { id: socket.id, name, color };
  room.users.set(socket.id, { name, color });
  room.usersMoves.set(socket.id, []);
  roomOf.set(socket.id, roomId);
  void socket.join(roomId);
  io.to(roomId).emit("new_user", user);
  return user;
}

function removeUser(io: TypedServer, socketId: string): void {
  const roomId = roomOf.get(socketId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) {
    room.users.delete(socketId);
    room.usersMoves.delete(socketId);
    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
    io.to(roomId).emit("user_disconnected", socketId);
  }
  roomOf.delete(socketId);
}

function stamp(move: DrawPayload): Move {
  return { ...move, id: randomUUID() };
}

async function main(): Promise<void> {
  const app = next({ dev: DEV, port: PORT });
  await app.prepare();
  const handle = app.getRequestHandler();

  const expressApp = express();
  expressApp.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
  });
  expressApp.use((req, res) => {
    void handle(req, res);
  });

  const httpServer = createServer(expressApp);
  const io: TypedServer = new Server(httpServer, { maxHttpBufferSize: 8e6 });

  io.on("connection", (socket: TypedSocket) => {
    socket.on("create_room", (name) => {
      const clean = name.trim().slice(0, 15);
      if (!clean) return;
      const roomId = createRoomId();
      rooms.set(roomId, { usersMoves: new Map(), drawed: [], users: new Map() });
      const user = joinRoom(io, socket, roomId, clean);
      if (!user) return;
      socket.emit("created", roomId);
      socket.emit("room", serializeRoom(rooms.get(roomId)!));
    });

    socket.on("check_room", (id) => {
      socket.emit("room_exists", rooms.has(id));
    });

    socket.on("join_room", (id, name) => {
      const clean = name.trim().slice(0, 15);
      if (!clean) {
        socket.emit("joined", null);
        return;
      }
      const user = joinRoom(io, socket, id.toUpperCase(), clean);
      if (!user) {
        socket.emit("joined", null);
        return;
      }
      socket.emit("joined", { roomId: id.toUpperCase(), color: user.color });
      socket.emit("room", serializeRoom(rooms.get(id.toUpperCase())!));
    });

    socket.on("leave_room", () => {
      removeUser(io, socket.id);
    });

    socket.on("draw", (rawMove) => {
      const roomId = roomOf.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const move = stamp(rawMove);
      room.drawed.push({ userId: socket.id, move });
      room.usersMoves.get(socket.id)?.push(move);
      socket.emit("your_move", move);
      socket.to(roomId).emit("user_draw", { userId: socket.id, move });
    });

    socket.on("undo", () => {
      const roomId = roomOf.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const stack = room.usersMoves.get(socket.id);
      const popped = stack?.pop();
      if (!popped) return;
      const idx = room.drawed.findIndex((d) => d.move.id === popped.id);
      if (idx !== -1) room.drawed.splice(idx, 1);
      io.to(roomId).emit("user_undo", socket.id);
    });

    socket.on("mouse_move", (pos) => {
      const roomId = roomOf.get(socket.id);
      if (!roomId) return;
      socket.to(roomId).emit("mouse_moved", { userId: socket.id, pos });
    });

    socket.on("send_msg", (text) => {
      const roomId = roomOf.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const clean = text.trim().slice(0, 500);
      if (!clean) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      io.to(roomId).emit("new_msg", {
        id: randomUUID(),
        name: user.name,
        color: user.color,
        text: clean,
      });
    });

    socket.on("emote", (payload) => {
      const roomId = roomOf.get(socket.id);
      if (!roomId) return;
      io.to(roomId).emit("emote", { userId: socket.id, ...payload });
    });

    socket.on("disconnect", () => {
      removeUser(io, socket.id);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Slate ready on http://localhost:${PORT} (dev=${DEV})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
