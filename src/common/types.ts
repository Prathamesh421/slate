export type Shape = "line" | "circle" | "rect" | "image";
export type CtxMode = "draw" | "eraser" | "select";
export type ToolMode = CtxMode | "pan";
export type EmoteType = "clap" | "heart" | "boo" | "boom" | "party";

export interface Point {
  x: number;
  y: number;
}

export interface MoveOptions {
  lineWidth: number;
  lineColor: string;
  fillColor: string;
  shape: Shape;
  mode: CtxMode;
}

export interface Move {
  circle?: { x: number; y: number; r: number };
  rect?: { x: number; y: number; w: number; h: number };
  img?: { base64: string; x: number; y: number; w: number; h: number };
  path?: Point[];
  options: MoveOptions;
  id: string;
}

export type DrawPayload = Omit<Move, "id" | "timestamp">;

export interface UserInfo {
  id: string;
  name: string;
  color: string;
}

export interface SerializedMove {
  userId: string;
  move: Move;
}

export interface RoomState {
  moves: SerializedMove[];
  users: UserInfo[];
  userMoveCounts: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  name: string;
  color: string;
  text: string;
}

export interface ClientToServerEvents {
  create_room: (name: string) => void;
  check_room: (id: string) => void;
  join_room: (id: string, name: string) => void;
  leave_room: () => void; 
  draw: (move: DrawPayload) => void;
  undo: () => void;
  mouse_move: (pos: Point) => void;
  send_msg: (text: string) => void;
  emote: (payload: { type: EmoteType; x: number; y: number }) => void;
}

export interface ServerToClientEvents {
  created: (roomId: string) => void;
  room_exists: (exists: boolean) => void;
  joined: (payload: { roomId: string; color: string } | null) => void;
  room: (state: RoomState) => void;
  your_move: (move: Move) => void;
  user_draw: (payload: { userId: string; move: Move }) => void;
  user_undo: (userId: string) => void;
  mouse_moved: (payload: { userId: string; pos: Point }) => void;
  new_user: (user: UserInfo) => void;
  user_disconnected: (userId: string) => void;
  new_msg: (message: ChatMessage) => void;
  emote: (payload: { userId: string; type: EmoteType; x: number; y: number }) => void;
}