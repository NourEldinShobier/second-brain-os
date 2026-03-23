import type { EntityId } from './ids.js';

/** Lightweight key result stored on goals (PRD §8). */
export interface KeyResult {
  readonly id: EntityId;
  readonly title: string;
  readonly done: boolean;
  readonly order: number;
}
