ALTER TABLE "knowledge_items" ADD COLUMN IF NOT EXISTS "groupe_path" VARCHAR(200);
ALTER TABLE "knowledge_items" ADD COLUMN IF NOT EXISTS "alarm_code" VARCHAR(50);
ALTER TABLE "knowledge_items" ADD COLUMN IF NOT EXISTS "vue_code" VARCHAR(50);
ALTER TABLE "q_r_uploads" ADD COLUMN IF NOT EXISTS "content" TEXT;
