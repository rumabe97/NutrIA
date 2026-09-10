-- When somebody was last shown the tour (`0038`). Null means never, which is
-- every account that existed before the tour did — they are the ones who most
-- need it, since they have been using a product whose features nobody named.
ALTER TABLE "profiles" ADD COLUMN "tour_seen_at" timestamp with time zone;
