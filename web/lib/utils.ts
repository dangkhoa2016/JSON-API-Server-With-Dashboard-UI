import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function tryParseJson(str: string): Record<string, unknown> {
  try { return JSON.parse(str) as Record<string, unknown> } catch { return {} }
}
