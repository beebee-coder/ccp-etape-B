/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chroma_index` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `data_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `executions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `integrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflows` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "executions" DROP CONSTRAINT "executions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "executions" DROP CONSTRAINT "executions_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_next_step_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_user_id_fkey";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "chroma_index";

-- DropTable
DROP TABLE "data_assignments";

-- DropTable
DROP TABLE "executions";

-- DropTable
DROP TABLE "integrations";

-- DropTable
DROP TABLE "workflow_steps";

-- DropTable
DROP TABLE "workflows";
