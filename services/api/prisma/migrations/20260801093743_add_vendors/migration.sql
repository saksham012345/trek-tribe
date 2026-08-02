-- CreateEnum
CREATE TYPE "vendor_category" AS ENUM ('hotel', 'homestay', 'campsite', 'transport', 'driver', 'guide', 'trek_leader', 'equipment_rental', 'food', 'photographer', 'videographer', 'permit_agency', 'emergency_contact', 'custom');

-- CreateEnum
CREATE TYPE "vendor_availability" AS ENUM ('available', 'busy', 'unavailable');

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp_number" TEXT,
    "category" "vendor_category" NOT NULL,
    "custom_category_label" TEXT,
    "address" TEXT,
    "gst_number" TEXT,
    "pricing_notes" TEXT,
    "rating" DECIMAL(65,30),
    "availability_status" "vendor_availability" NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_organizer_id_idx" ON "vendors"("organizer_id");
