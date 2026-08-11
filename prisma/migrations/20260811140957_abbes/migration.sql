/*
  Warnings:

  - The primary key for the `alarm_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `alarm_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `alarm_id` on the `alarm_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `alarms` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `groupe_path` on the `alarms` table. All the data in the column will be lost.
  - You are about to drop the column `location_type` on the `alarms` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `alarms` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `audit_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `chroma_index` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `chroma_index` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `data_assignments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `file_path` on the `data_assignments` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `data_assignments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `executions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `workflow_id` on the `executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `current_step_id` on the `executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `guardrail_rules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `guardrail_rules` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `integrations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `integrations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `integrations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `iot_sensor_readings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `iot_sensor_readings` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `knowledge_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `knowledge_items` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `knowledge_items` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `location_nodes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `location_nodes` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `meeting_chat_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_id` on the `meeting_chat_messages` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `meeting_chat_messages` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `meeting_id` on the `meeting_chat_messages` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `meetings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `meetings` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `procedure_executions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `current_step` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `procedure_executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `procedure_id` on the `procedure_executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `operator_id` on the `procedure_executions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `procedure_steps` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `procedure_steps` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `procedure_id` on the `procedure_steps` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `procedures` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `procedures` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `q_r_uploads` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `q_r_uploads` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `q_r_uploads` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `reports` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `reports` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `date` on the `reports` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The `points` column on the `reports` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `workflow_steps` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `workflow_steps` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `workflow_id` on the `workflow_steps` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `next_step_id` on the `workflow_steps` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `workflows` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `workflows` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `user_id` on the `workflows` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Added the required column `locationType` to the `alarms` table without a default value. This is not possible if the table is not empty.
  - Made the column `metadata_json` on table `chroma_index` required. This step will fail if there are existing NULL values in that column.
  - Made the column `credentials` on table `integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `media_items` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `userId` to the `meeting_chat_messages` table without a default value. This is not possible if the table is not empty.
  - Made the column `avatar` on table `team_members` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "alarm_events" DROP CONSTRAINT "alarm_events_alarm_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_user_id_fkey";

-- DropForeignKey
ALTER TABLE "executions" DROP CONSTRAINT "executions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "executions" DROP CONSTRAINT "executions_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "iot_actuators" DROP CONSTRAINT "iot_actuators_device_id_fkey";

-- DropForeignKey
ALTER TABLE "iot_sensor_readings" DROP CONSTRAINT "iot_sensor_readings_device_id_fkey";

-- DropForeignKey
ALTER TABLE "meeting_chat_messages" DROP CONSTRAINT "meeting_chat_messages_meeting_id_fkey";

-- DropForeignKey
ALTER TABLE "procedure_executions" DROP CONSTRAINT "procedure_executions_operator_id_fkey";

-- DropForeignKey
ALTER TABLE "procedure_executions" DROP CONSTRAINT "procedure_executions_procedure_id_fkey";

-- DropForeignKey
ALTER TABLE "procedure_steps" DROP CONSTRAINT "procedure_steps_procedure_id_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_team_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_next_step_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_user_id_fkey";

-- DropIndex
DROP INDEX "idx_alarms_location";

-- DropIndex
DROP INDEX "idx_meeting_chat_user";

-- AlterTable
ALTER TABLE "alarm_events" DROP CONSTRAINT "alarm_events_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "alarm_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "occurred_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "alarm_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "alarms" DROP CONSTRAINT "alarms_pkey",
DROP COLUMN "groupe_path",
DROP COLUMN "location_type",
ADD COLUMN     "groupePath" VARCHAR(200),
ADD COLUMN     "locationType" VARCHAR(20) NOT NULL,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "triggered_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "resolved_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "alarms_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chroma_index" DROP CONSTRAINT "chroma_index_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "metadata_json" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "chroma_index_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "data_assignments" DROP CONSTRAINT "data_assignments_pkey",
DROP COLUMN "file_path",
ADD COLUMN     "filePath" TEXT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "data_assignments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "etat_des_lieux_reports" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "executions" DROP CONSTRAINT "executions_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "workflow_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "current_step_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "executions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "guardrail_rules" DROP CONSTRAINT "guardrail_rules_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "guardrail_rules_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "credentials" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "iot_actuators" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "iot_devices" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "iot_sensor_readings" DROP CONSTRAINT "iot_sensor_readings_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "iot_sensor_readings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "knowledge_items" DROP CONSTRAINT "knowledge_items_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "location_nodes" DROP CONSTRAINT "location_nodes_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "location_nodes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "media_items" ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "meeting_chat_messages" DROP CONSTRAINT "meeting_chat_messages_pkey",
DROP COLUMN "user_id",
ADD COLUMN     "userId" VARCHAR(255) NOT NULL,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "meeting_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "meeting_chat_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ended_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "procedure_executions" DROP CONSTRAINT "procedure_executions_pkey",
DROP COLUMN "current_step",
ADD COLUMN     "currentStep" INTEGER,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "procedure_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "operator_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "start_time" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_time" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "procedure_executions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "procedure_steps" DROP CONSTRAINT "procedure_steps_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "procedure_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "procedure_steps_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "procedures" DROP CONSTRAINT "procedures_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "last_executed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "procedures_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "q_r_uploads" DROP CONSTRAINT "q_r_uploads_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "q_r_uploads_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reports" DROP CONSTRAINT "reports_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "date" SET DATA TYPE VARCHAR(255),
DROP COLUMN "points",
ADD COLUMN     "points" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "team_members" ALTER COLUMN "avatar" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "workflow_id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "next_step_id" SET DATA TYPE VARCHAR(100),
ADD CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "alarms_locationType_location_path_idx" ON "alarms"("locationType", "location_path");

-- CreateIndex
CREATE INDEX "knowledge_items_location_type_location_path_idx" ON "knowledge_items"("location_type", "location_path");

-- CreateIndex
CREATE INDEX "knowledge_items_bloc_code_idx" ON "knowledge_items"("bloc_code");

-- CreateIndex
CREATE INDEX "meeting_chat_messages_userId_idx" ON "meeting_chat_messages"("userId");

-- AddForeignKey
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_executions" ADD CONSTRAINT "procedure_executions_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_executions" ADD CONSTRAINT "procedure_executions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_next_step_id_fkey" FOREIGN KEY ("next_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_actuators" ADD CONSTRAINT "iot_actuators_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_sensor_readings" ADD CONSTRAINT "iot_sensor_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_chat_messages" ADD CONSTRAINT "meeting_chat_messages_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_alarm_id_fkey" FOREIGN KEY ("alarm_id") REFERENCES "alarms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_alarm_events_alarm" RENAME TO "alarm_events_alarm_id_idx";

-- RenameIndex
ALTER INDEX "idx_alarm_events_occurred" RENAME TO "alarm_events_occurred_at_idx";

-- RenameIndex
ALTER INDEX "idx_alarms_bloc" RENAME TO "alarms_bloc_code_idx";

-- RenameIndex
ALTER INDEX "idx_alarms_code" RENAME TO "alarms_code_idx";

-- RenameIndex
ALTER INDEX "idx_alarms_status" RENAME TO "alarms_status_idx";

-- RenameIndex
ALTER INDEX "idx_audit_logs_action" RENAME TO "audit_logs_action_idx";

-- RenameIndex
ALTER INDEX "idx_audit_logs_resource" RENAME TO "audit_logs_resource_type_resource_id_idx";

-- RenameIndex
ALTER INDEX "idx_audit_logs_user" RENAME TO "audit_logs_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_client" RENAME TO "chat_messages_client_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_conversation" RENAME TO "chat_messages_conversation_id_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_procedure" RENAME TO "chat_messages_procedure_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_timestamp" RENAME TO "chat_messages_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_user" RENAME TO "chat_messages_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_chroma_collection" RENAME TO "chroma_index_collection_idx";

-- RenameIndex
ALTER INDEX "idx_chroma_document" RENAME TO "chroma_index_document_id_idx";

-- RenameIndex
ALTER INDEX "idx_data_assignments_entity" RENAME TO "data_assignments_entity_type_entity_id_idx";

-- RenameIndex
ALTER INDEX "idx_data_assignments_location" RENAME TO "data_assignments_location_type_location_path_idx";

-- RenameIndex
ALTER INDEX "idx_edl_author" RENAME TO "etat_des_lieux_reports_author_role_idx";

-- RenameIndex
ALTER INDEX "idx_edl_status" RENAME TO "etat_des_lieux_reports_status_idx";

-- RenameIndex
ALTER INDEX "idx_executions_status" RENAME TO "executions_status_idx";

-- RenameIndex
ALTER INDEX "idx_executions_user" RENAME TO "executions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_executions_workflow" RENAME TO "executions_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_guardrail_active" RENAME TO "guardrail_rules_is_active_idx";

-- RenameIndex
ALTER INDEX "idx_guardrail_section" RENAME TO "guardrail_rules_section_idx";

-- RenameIndex
ALTER INDEX "idx_integrations_user" RENAME TO "integrations_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_iot_actuators_device" RENAME TO "iot_actuators_device_id_idx";

-- RenameIndex
ALTER INDEX "idx_iot_devices_status" RENAME TO "iot_devices_connection_status_idx";

-- RenameIndex
ALTER INDEX "idx_iot_readings_created" RENAME TO "iot_sensor_readings_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_iot_readings_device" RENAME TO "iot_sensor_readings_device_id_idx";

-- RenameIndex
ALTER INDEX "idx_knowledge_type" RENAME TO "knowledge_items_type_idx";

-- RenameIndex
ALTER INDEX "idx_knowledge_user" RENAME TO "knowledge_items_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_knowledge_user_type" RENAME TO "knowledge_items_user_id_type_idx";

-- RenameIndex
ALTER INDEX "idx_location_nodes_bloc" RENAME TO "location_nodes_bloc_code_idx";

-- RenameIndex
ALTER INDEX "idx_location_nodes_path" RENAME TO "location_nodes_path_idx";

-- RenameIndex
ALTER INDEX "idx_location_nodes_type" RENAME TO "location_nodes_location_type_idx";

-- RenameIndex
ALTER INDEX "idx_media_category" RENAME TO "media_items_category_idx";

-- RenameIndex
ALTER INDEX "idx_media_kind" RENAME TO "media_items_kind_idx";

-- RenameIndex
ALTER INDEX "idx_meeting_chat_meeting" RENAME TO "meeting_chat_messages_meeting_id_idx";

-- RenameIndex
ALTER INDEX "idx_meeting_chat_timestamp" RENAME TO "meeting_chat_messages_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_meetings_created_by" RENAME TO "meetings_created_by_idx";

-- RenameIndex
ALTER INDEX "idx_meetings_ended" RENAME TO "meetings_ended_at_idx";

-- RenameIndex
ALTER INDEX "idx_meetings_started" RENAME TO "meetings_started_at_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_executions_created" RENAME TO "procedure_executions_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_executions_operator" RENAME TO "procedure_executions_operator_id_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_executions_procedure" RENAME TO "procedure_executions_procedure_id_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_executions_procedure_code" RENAME TO "procedure_executions_procedure_code_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_executions_status" RENAME TO "procedure_executions_status_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_steps_order" RENAME TO "procedure_steps_procedure_id_step_order_idx";

-- RenameIndex
ALTER INDEX "idx_procedure_steps_procedure" RENAME TO "procedure_steps_procedure_id_idx";

-- RenameIndex
ALTER INDEX "idx_procedures_category" RENAME TO "procedures_category_idx";

-- RenameIndex
ALTER INDEX "idx_procedures_code" RENAME TO "procedures_code_idx";

-- RenameIndex
ALTER INDEX "idx_qr_uploads_set_name" RENAME TO "q_r_uploads_set_name_idx";

-- RenameIndex
ALTER INDEX "idx_qr_uploads_user" RENAME TO "q_r_uploads_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_reports_created" RENAME TO "reports_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_reports_date" RENAME TO "reports_date_idx";

-- RenameIndex
ALTER INDEX "idx_team_members_email" RENAME TO "team_members_email_idx";

-- RenameIndex
ALTER INDEX "idx_team_members_team" RENAME TO "team_members_team_id_idx";

-- RenameIndex
ALTER INDEX "idx_teams_name" RENAME TO "teams_name_idx";

-- RenameIndex
ALTER INDEX "idx_users_email" RENAME TO "users_email_idx";

-- RenameIndex
ALTER INDEX "idx_users_role" RENAME TO "users_role_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_steps_workflow" RENAME TO "workflow_steps_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_status" RENAME TO "workflows_status_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_user" RENAME TO "workflows_user_id_idx";
