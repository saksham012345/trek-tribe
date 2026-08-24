/*
  Warnings:

  - You are about to drop the column `errors` on the `imported_databases` table. All the data in the column will be lost.
  - You are about to drop the column `import_config` on the `imported_databases` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "imported_databases" DROP COLUMN "errors",
DROP COLUMN "import_config",
ADD COLUMN     "can_rollback" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "import_errors" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "imported_lead_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "processed_rows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progress_percentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rolled_back_at" TIMESTAMP(3),
ADD COLUMN     "total_rows" INTEGER NOT NULL DEFAULT 0;

-- Progress is a percentage, and a run cannot process more rows than it has.
ALTER TABLE "imported_databases"
  ADD CONSTRAINT "imported_databases_progress_0_to_100"
  CHECK ("progress_percentage" BETWEEN 0 AND 100);

ALTER TABLE "imported_databases"
  ADD CONSTRAINT "imported_databases_processed_within_total"
  CHECK ("processed_rows" >= 0 AND "total_rows" >= 0 AND "processed_rows" <= "total_rows");
