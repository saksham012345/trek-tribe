-- CreateTable
CREATE TABLE "trip_vendor_assignments" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "category" "vendor_category" NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_vendor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_vendor_assignments_trip_id_idx" ON "trip_vendor_assignments"("trip_id");

-- CreateIndex
CREATE INDEX "trip_vendor_assignments_vendor_id_idx" ON "trip_vendor_assignments"("vendor_id");

-- AddForeignKey
ALTER TABLE "trip_vendor_assignments" ADD CONSTRAINT "trip_vendor_assignments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
