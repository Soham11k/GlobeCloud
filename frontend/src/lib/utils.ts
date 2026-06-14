import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCopilot(text: string): string {
  return text;
}

export const REGION_LABELS: Record<string, string> = {
  "us-east-1": "US East",
  "eu-west-1": "EU West",
  "ap-south-1": "AP South",
};

export const CHECKLIST_KEY = "globecloud_checklist";
export const API_KEY_STORAGE = "globecloud_api_key";
