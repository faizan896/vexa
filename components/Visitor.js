"use client";
import { useEffect } from "react";
import { trackVisit } from "@/lib/analytics";

/** Fires the new-vs-returning visitor signal once per session. */
export default function Visitor() {
  useEffect(() => { trackVisit(); }, []);
  return null;
}
