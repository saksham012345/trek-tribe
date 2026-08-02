-- CreateEnum
CREATE TYPE "vendor_payment_status" AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "paid_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "status" "vendor_payment_status" NOT NULL DEFAULT 'pending',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payment_history" (
    "id" TEXT NOT NULL,
    "vendor_payment_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "vendor_payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payments_assignment_id_key" ON "vendor_payments"("assignment_id");

-- CreateIndex
CREATE INDEX "vendor_payment_history_vendor_payment_id_idx" ON "vendor_payment_history"("vendor_payment_id");

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "trip_vendor_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_history" ADD CONSTRAINT "vendor_payment_history_vendor_payment_id_fkey" FOREIGN KEY ("vendor_payment_id") REFERENCES "vendor_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
