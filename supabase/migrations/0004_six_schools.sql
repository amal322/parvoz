-- Parvoz · 0004 · six schools
-- Central Asian University has six schools. Adds the two that were missing.
-- No begin/commit here: a new enum value cannot be used in the transaction that adds it.
alter type parvoz.school add value if not exists 'architecture';  -- School of Architecture and Design
alter type parvoz.school add value if not exists 'hospitality';   -- School of Tourism and Hospitality
