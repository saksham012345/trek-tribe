-- The Mongoose KnowledgeBase declared a text index across title, content,
-- summary and tags, and semanticSearch ranked by $meta:'textScore'. That index
-- was missed when this table was first created; without it the ported search
-- would fall back to a sequential scan and rank nothing.
--
-- summary is nullable, so it is coalesced - concatenating NULL would make the
-- whole document unsearchable rather than just omitting its summary.
CREATE INDEX "knowledge_base_search_idx" ON "knowledge_base"
  USING GIN (to_tsvector('english'::regconfig,
    "title" || ' ' || coalesce("summary", '') || ' ' || "content"));
