// The small icons on buttons, drawn in the button's text color.
import { html } from './dom.js';

const EYE_OUTLINE = html`
  <path
    d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"
    fill="none" stroke="currentColor" stroke-width="1.3"/>`;

export const EYE = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    ${EYE_OUTLINE}
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
  </svg>`;

export const EYE_OFF = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    ${EYE_OUTLINE}
    <path d="M3 13.5L13 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

export const EYE_DETAIL = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="6.8" cy="6.8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M10 10l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

export const TRASH = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.3 4.3l.6 9h6.2l.6-9M6.8 6.6v4.6M9.2 6.6v4.6"
      fill="none" stroke="currentColor" stroke-width="1.3"
      stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;

export const GRIP = html`
  <span class="grip" aria-hidden="true">
    <svg viewBox="0 0 16 16">
      <g fill="currentColor">
        <circle cx="6" cy="4" r="1.2"/><circle cx="10" cy="4" r="1.2"/>
        <circle cx="6" cy="8" r="1.2"/><circle cx="10" cy="8" r="1.2"/>
        <circle cx="6" cy="12" r="1.2"/><circle cx="10" cy="12" r="1.2"/>
      </g>
    </svg>
  </span>`;

export const COPY = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect
      x="5.5" y="5.5" width="8" height="8" rx="1.3"
      fill="none" stroke="currentColor" stroke-width="1.3"/>
    <path
      d="M10.5 3.5V3a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5"
      fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;

export const PENCIL = html`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M10.9 2.6l2.5 2.5-7.6 7.6-3.3.8.8-3.3zM9.5 4l2.5 2.5"
      fill="none" stroke="currentColor" stroke-width="1.3"
      stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
