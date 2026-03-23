/** Markdown bodies for seeded files — `second_brain` block matches domain/markdown/second-brain-meta.ts. */

export const README_WORKSPACE = `# Second Brain workspace

This folder is your **local-first** Second Brain: notes, tasks, and projects live here as Markdown files.
A small SQLite index under \`.second-brain/\` makes search and dashboards fast; the **files stay the source of truth**.

Each entity file starts with YAML front matter under the \`second_brain\` key: stable \`id\`, \`kind\`, \`slug\`, and \`status\`.

## PARA (how things are grouped)

- **Projects** — short efforts with a clear outcome.
- **Areas** — ongoing responsibilities (health, career, family).
- **Resources** — reference material you may reuse.
- **Archive** — inactive items you might bring back later.

## CODE (how work flows)

- **Capture** — get ideas into the inbox quickly.
- **Organize** — move items into areas, projects, and tasks.
- **Distill** — refine notes into durable ideas.
- **Express** — turn knowledge into action (tasks, writing, decisions).

## Next steps

1. Glance at \`01-areas/\` and \`06-notes/\` for the included examples.
2. Add something to \`00-inbox/\` whenever inspiration hits.
3. Run \`second-brain-os doctor\` to confirm paths when the CLI is fully wired up.

You do not need to master every concept on day one — capture first, organize second.
`;

export const EXAMPLE_AREA = `---
second_brain:
  id: "11111111-1111-4111-8111-111111111111"
  kind: area
  version: 1
  slug: personal
  title: Personal
  status: active
  archived: false
---

This is an **example area** — a long-lived bucket for life domains like health, family, or hobbies.

Link projects, tasks, and notes here as you go. You can rename this file or add more areas anytime.
`;

export const EXAMPLE_NOTE = `---
second_brain:
  id: "22222222-2222-4222-8222-222222222222"
  kind: note
  version: 1
  slug: how-your-second-brain-works
  title: How your Second Brain works
  status: active
  archived: false
---

Your Second Brain is a **working system**, not a filing cabinet.

- **Inbox** is for quick captures before you know where they belong.
- **Areas** anchor ongoing responsibility.
- **Projects** finish; **areas** continue.

When in doubt, capture now and organize in a weekly review.
`;

export const FIRST_CAPTURE = `---
second_brain:
  id: "33333333-3333-4333-8333-333333333333"
  kind: inbox_item
  version: 1
  slug: starter-capture
  title: Starter capture
  status: inbox
  archived: false
---

Drop raw thoughts here before you sort them into areas, projects, or tasks.

You can delete this file once you have your own rhythm.
`;
