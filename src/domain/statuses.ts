/** Shared lifecycle for many core entities. */
export type EntityLifecycleStatus = 'inbox' | 'active' | 'done' | 'archived';

export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'scheduled' | 'done' | 'cancelled';

export type ProjectStatus = 'inbox' | 'active' | 'on_hold' | 'done' | 'cancelled';

export type GoalStatus = 'draft' | 'active' | 'completed' | 'abandoned';

export type ResourceStatus = 'inbox' | 'active' | 'archived';

export type NoteStatus = 'inbox' | 'active' | 'archived';

export type AreaStatus = 'active' | 'archived';
