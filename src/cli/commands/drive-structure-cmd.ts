import type { Command } from 'commander';
import { aggregateDriveStructure } from '../../application/drive-structure-aggregation.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import * as presentation from '../presentation/blocks.js';

export async function runDriveStructure(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const next = [
      'Create a workspace with `second-brain-os init`.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const structure = aggregateDriveStructure(db);

    if (isJsonOutput(ctx)) {
      const env = successEnvelope(structure, [], []);
      printJsonEnvelope(env);
      return;
    }

    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'Drive Structure:');

      for (const folder of structure.folders) {
        const unsorted = folder.path === '000-inbox';
        const label = unsorted
          ? `${folder.path}/ (${folder.total_items} items) ← Unsorted`
          : `${folder.path}/ (${folder.total_items} items)`;
        presentation.bodyLine(ctx, label);

        if (folder.children.length === 0 && folder.total_items === 0) {
          presentation.bodyLine(ctx, '  (empty)');
        } else {
          for (const child of folder.children) {
            const title = child.entity_title ? ` (${child.entity_title})` : '';
            presentation.bodyLine(
              ctx,
              `  └── ${child.entity_slug}${title} - ${child.drive_item_count} items`,
            );
          }
        }
      }

      presentation.bodyLine(ctx, '');
      presentation.bodyLine(ctx, `Total: ${structure.total_drive_items} items`);
      if (structure.unsorted_count > 0) {
        const legacyPart =
          structure.legacy_count > 0 ? ` (${structure.legacy_count} legacy flat)` : '';
        presentation.bodyLine(
          ctx,
          `Unsorted: ${structure.unsorted_count} items in inbox${legacyPart}`,
        );
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}
