"use client";

import { useAtomValue } from "jotai";
import { myIdAtom, usersAtom } from "@/atoms/room";

export function UserList() {
  const users = useAtomValue(usersAtom);
  const myId = useAtomValue(myIdAtom);

  return (
    <div className="absolute right-4 top-4 z-20 flex flex-row-reverse">
      {users.map((u, i) => (
        <div
          key={u.id}
          title={u.name + (u.id === myId ? " (you)" : "")}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white ${
            u.id === myId ? "ring-4" : ""
          }`}
          style={{
            backgroundColor: u.color,
            marginLeft: i === 0 ? 0 : -10,
            marginRight: i === users.length - 1 ? 0 : -10,
            zIndex: users.length - i,
          }}
        >
          {u.name.slice(0, 1).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
