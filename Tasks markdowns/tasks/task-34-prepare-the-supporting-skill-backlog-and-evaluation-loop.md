# Task 34: Prepare The Supporting Skill Backlog And Evaluation Loop

- Task ID: `T-34`
- Status: `Done`
- Epic: `Epic 12 - Testing, Validation, And Skill Follow-Up`
- PRD sections: `20`, `22`, `25`, `27`
- Depends on: `T-29`, `T-33`

## Objective

Prepare the follow-up backlog for the `second-brain` skill so it can wrap the CLI once the command surface is stable.

## Scope

- Translate the PRD’s skill requirements into a CLI-wrapping skill backlog.
- Define trigger conditions, expected command-routing behaviors, error recovery patterns, and test prompts.
- Plan the with-skill vs without-skill evaluation loop using the `skill-creator` workflow after CLI stabilization.

## Implementation Steps

1. Enumerate the stable CLI workflows the skill should orchestrate first.
2. Define the skill’s trigger and recovery expectations without duplicating business logic.
3. Draft the evaluation loop inputs needed to compare with-skill and without-skill performance later.

## Acceptance Criteria

- The skill plan explicitly wraps the CLI instead of bypassing it.
- The backlog is ready once the CLI contract is stable.
- The evaluation loop includes realistic agent usage scenarios and recovery cases.

## Files Likely To Change

- future skill planning docs
- evaluation prompt/backlog docs
- CLI contract reference docs

## Verification

- Review the resulting skill backlog against the PRD rule that the skill must orchestrate the CLI.
- Confirm the evaluation plan covers dashboard retrieval, inbox processing, query commands, and common CLI errors.

**Shipped:** Draft **`second-brain-os`** skill pack (`SKILL.md`, `references/`, `evals/evals.json`), installable under whatever directory your AI/IDE expects (e.g. Cursor-style `.cursor/skills/second-brain-os/`). Run the skill-creator eval loop (with-skill vs without-skill, aggregate benchmark) when you want measured scores.
