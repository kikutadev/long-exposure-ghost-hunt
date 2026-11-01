import type { DeathCause } from './shot';

const GHOST_IMAGES = ['ghost-base.png', 'ghost-fast.png', 'ghost-near.png'];

export function deathDescription(cause: DeathCause, act = 0) {
  if (cause === 'TOO CLOSE') return 'IT CAME TOO CLOSE. YOUR CAMERA COULD NOT SAVE YOU.';
  if (act === 1) return 'YOU HELD THE SHUTTER OPEN. THE FILM BURNED AWAY.';
  return 'YOU HELD THE SHUTTER OPEN. IT FOUND ITS WAY THROUGH.';
}

/** Only presents a death. The game loop owns fatal detection and input lockout. */
export class DeathScreen {
  private ghost: HTMLImageElement;
  private reason: HTMLElement;
  private heading: HTMLElement | null;
  private panel: HTMLElement;
  private assetsBaseUrl: string;

  constructor(panel: HTMLElement, assetsBaseUrl: string) {
    this.panel = panel;
    this.assetsBaseUrl = assetsBaseUrl;
    const ghost = panel.querySelector<HTMLImageElement>('#death-ghost');
    const reason = panel.querySelector<HTMLElement>('#death-reason');
    if (!ghost || !reason) throw new Error('Missing death screen elements');
    this.ghost = ghost;
    this.reason = reason;
    this.heading = panel.querySelector<HTMLElement>('#death-heading');
  }

  reset() {
    this.panel.classList.add('hidden');
    this.panel.classList.remove('death-arrive');
  }

  show(cause: DeathCause, act: number, finalFrame?: string) {
    this.ghost.src = finalFrame ?? `${this.assetsBaseUrl}assets/${GHOST_IMAGES[act]}`;
    this.ghost.alt = finalFrame ? 'The camera’s final view of the classroom' : 'A presence by the camera';
    if (this.heading) this.heading.textContent = cause === 'TOO CLOSE' ? 'IT REACHED\nYOU.'
      : act === 1 ? 'EXPOSURE\nLOST.' : 'YOU WERE\nSEEN.';
    this.reason.textContent = deathDescription(cause, act);
    this.panel.classList.remove('hidden', 'death-arrive');
    // Restart CSS animation on a subsequent death, even after RESTART.
    void this.panel.offsetHeight;
    this.panel.classList.add('death-arrive');
  }
}