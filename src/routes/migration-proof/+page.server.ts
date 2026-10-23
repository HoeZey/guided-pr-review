import { MIGRATION_PROOF, type MigrationProof } from "$lib/shared/migration-proof";

export function load(): MigrationProof {
  return MIGRATION_PROOF;
}
