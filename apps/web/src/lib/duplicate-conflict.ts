import { askDuplicateConflict, type DuplicateResolution } from "@/components/common/DuplicateConflictDialog";
import type { DuplicatePersonConflict } from "@/lib/api";

/**
 * The 409 dialog flow shared by the client/lead forms.
 *
 * Strict (email) conflicts never allow a second row — the only way forward is
 * the existing record, so we offer to jump straight there. Weak (name/phone)
 * conflicts are the user's call: confirm means "different person, add anyway"
 * and the form re-submits with allow_duplicate.
 * Rendered by the animated DuplicateConflictDialogHost (record-preview card,
 * staged entrance) instead of a plain text confirm.
 */
export type { DuplicateResolution };

export async function resolveDuplicateConflict(
  conflict: DuplicatePersonConflict
): Promise<DuplicateResolution> {
  return askDuplicateConflict(conflict);
}
