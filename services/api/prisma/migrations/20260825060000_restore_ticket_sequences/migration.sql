-- Restores two column defaults that a later `prisma migrate diff` removed.
--
-- The defaults were added by hand in earlier migrations, but the Prisma schema
-- did not declare them. migrate diff compares the database against the schema
-- and removes whatever the schema does not know about - so the next generated
-- migration quietly emitted DROP DEFAULT, and ticket ids started coming back
-- NULL against a NOT NULL column.
--
-- The schema declares them with @default(dbgenerated(...)) now, so the diff sees
-- them as intended rather than as drift. Hand-written CHECK constraints are not
-- at risk the same way: Prisma does not model CHECKs at all, so diff leaves them
-- alone. It is specifically the things Prisma *does* model - defaults, columns,
-- indexes - that hand-written SQL cannot hold on its own.
ALTER TABLE "support_tickets"
  ALTER COLUMN "ticket_id"
  SET DEFAULT ('TT-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('support_ticket_number_seq')::text, 4, '0'));

ALTER TABLE "tickets"
  ALTER COLUMN "ticket_number"
  SET DEFAULT ('TKT-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('ticket_number_seq')::text, 4, '0'));
