// Everything is kept in this browser's localStorage: your tools, progress and notebooks under one
// key, each sheet's construction under its own, and how the page was left under a third.
import { toast } from './widgets.js';

export const STATE_KEY = 'euclid-toolkit:state';
export const WORK_KEY = 'euclid-toolkit:work:';
export const UI_KEY = 'euclid-toolkit:ui';

// What's saved under a key, or null (nothing, or storage that can't be read).
export function lsGet(key) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// If saving fails (storage full, or turned off), the page says so when it starts failing, and again
// if it starts failing again after working.
let saveFailing = false;
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    saveFailing = false;
  } catch {
    if (!saveFailing) {
      saveFailing = true;
      toast("Your work isn't being saved: this browser's storage is full or turned off.");
    }
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage that can't be changed has nothing to delete
  }
}
