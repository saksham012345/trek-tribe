-- AddForeignKey
ALTER TABLE "vendor_communication_log" ADD CONSTRAINT "vendor_communication_log_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
