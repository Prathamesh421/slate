"use client";

import { useSyncExternalStore } from "react";
import { useAtom } from "jotai";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { modalAtom, userNameAtom } from "@/atoms/room";

export function ModalManager() {
  const [modal, setModal] = useAtom(modalAtom);
  const router = useRouter();
  const [name, setName] = useAtom(userNameAtom);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) return null;

  const close = () => setModal(null);

  return createPortal(
    <AnimatePresence>
      {modal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.kind === "notFound" && (
              <>
                <h2 className="text-lg font-bold text-zinc-800">Room not found</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  This room doesn&apos;t exist (or hasn&apos;t been created yet).
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      close();
                      router.push("/");
                    }}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Go home
                  </button>
                </div>
              </>
            )}

            {modal.kind === "joinFail" && (
              <>
                <h2 className="text-lg font-bold text-zinc-800">Can&apos;t join</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  That room doesn&apos;t exist or is full (12 people max).
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      close();
                      router.push("/");
                    }}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Back to home
                  </button>
                </div>
              </>
            )}

            {modal.kind === "nameGate" && (
              <>
                <h2 className="text-lg font-bold text-zinc-800">What&apos;s your name?</h2>
                <p className="mt-2 text-sm text-zinc-500">Others will see you as this.</p>
                <input
                  autoFocus
                  maxLength={15}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      close();
                    }
                  }}
                  className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                  placeholder="Your name"
                />
                <div className="mt-5 flex justify-end">
                  <button
                    disabled={!name.trim()}
                    onClick={close}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
                  >
                    Enter
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
