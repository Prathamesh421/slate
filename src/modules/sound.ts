import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { play } from "cuelume";
import { mutedAtom } from "@/atoms/room";

function vibrate(pattern: number | number[]): void {
  navigator.vibrate?.(pattern);
}

export function useSound() {
  const muted = useAtomValue(mutedAtom);

  const pop = useCallback(() => {
    if (muted) return;
    play("tick");
    vibrate(12);
  }, [muted]);

  const chime = useCallback(() => {
    if (muted) return;
    play("chime");
  }, [muted]);

  const place = useCallback(() => {
    if (muted) return;
    play("press");
    vibrate(10);
  }, [muted]);

  return { pop, chime, place };
}
