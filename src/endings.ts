// Outcomes already present in the game. Unknown entries stay sealed until seen.
export const ENDINGS = [
  { id: 'seen', title: 'YOU WERE SEEN.', note: 'THE ONE WHO WAITS / OVEREXPOSED' },
  { id: 'run-through', title: 'IT RAN THROUGH.', note: 'THE ONE WHO RUNS / COLLISION' },
  { id: 'reached', title: 'IT REACHED YOU.', note: 'THE ONE WHO WATCHES / CONTACT' },
  { id: 'fourth', title: 'EXPOSURE 004.', note: 'OPERATOR: UNKNOWN' }
] as const;

export type EndingId = typeof ENDINGS[number]['id'];
type LocalStore = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'long-exposure:endings:v1';
const known = new Set<string>(ENDINGS.map(e => e.id));

export class EndingArchive {
  private discovered = new Set<EndingId>();
  private store: LocalStore | null = null;

  constructor(storage?: LocalStore | null) {
    try {
      this.store = storage === undefined
        ? (typeof window === 'undefined' ? null : window.localStorage)
        : storage;
      const saved: unknown = JSON.parse(this.store?.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        for (const id of saved) if (typeof id === 'string' && known.has(id))
          this.discovered.add(id as EndingId);
      }
    } catch {
      // Storage may be blocked or an old record may be invalid. Neither
      // prevents playing or collecting endings in this tab.
    }
  }

  has(id: EndingId) { return this.discovered.has(id); }
  get count() { return this.discovered.size; }

  unlock(id: EndingId) {
    if (this.discovered.has(id)) return false;
    this.discovered.add(id);
    try {
      this.store?.setItem(STORAGE_KEY, JSON.stringify([...this.discovered]));
    } catch { /* Keep the in-memory discovery if storage is unavailable. */ }
    return true;
  }
}
