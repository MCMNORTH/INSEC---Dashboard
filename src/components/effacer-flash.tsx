"use client";

import { useEffect } from "react";

export function EffacerFlash() {
  useEffect(() => {
    document.cookie = "insec_flash=; Max-Age=0; path=/; SameSite=Lax";
  }, []);
  return null;
}
