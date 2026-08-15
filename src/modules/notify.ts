import { toast } from "react-toastify";

export function notify(text: string, kind: "success" | "info" | "error" = "info"): void {
  toast(text, { type: kind, position: "top-center", autoClose: 2200 });
}
