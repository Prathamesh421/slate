"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ModalManager } from "./ModalManager";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ModalManager />
      <ToastContainer
        position="top-center"
        autoClose={2200}
        hideProgressBar
        newestOnTop
        closeButton={false}
        theme="colored"
        style={{ zIndex: 60 }}
        toastStyle={{ borderRadius: 6, fontSize: 13, padding: "10px 14px" }}
      />
    </>
  );
}