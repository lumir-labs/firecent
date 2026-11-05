import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeForSearch(str: string): string {
  return `${str
    .normalize("NFD") // decomposes combined characters
    .replace(/[\u0300-\u036f]/g, "") // removes diacritics
    .toLowerCase()}`;
}

export function normalizeToLocalDate(date: Date | undefined): Date | undefined {
  if (!date) return undefined;

  // Extract UTC components and create a new date in local time
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  // Create the date at midnight in LOCAL time
  return new Date(year, month, day, 0, 0, 0, 0);
}
