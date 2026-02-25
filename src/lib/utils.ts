import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return `${amount.toLocaleString('en-EG')} EGP`;
}

export function getDistance(city1: string, city2: string) {
  // Simple mock distance logic for sorting
  if (city1 === city2) return 0;
  return 1; // In a real app, we'd have a distance matrix
}
