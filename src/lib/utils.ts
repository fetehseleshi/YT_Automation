import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export colorFor so shared UI primitives (e.g. ui.tsx) can import it from
// "@/lib/utils". The canonical definition lives in "@/lib/api".
export { colorFor } from "@/lib/api";

