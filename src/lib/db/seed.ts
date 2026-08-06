import { mockProcedures } from "@/lib/procedures/mock-data";
import { teams } from "@/data/teams";
import { query } from "../db";
import fs from "fs";
import path from "path";

const CHROMA_INDEX_PATH = path.join(
  process.cwd(),
  ".local-db",
  "chroma-index.json",
);

export async function seedProcedures(): Promise<void> {
  console.log("🌱 Seeding procedures...");

  for (const procedure of mockProcedures) {
    const metadata = procedure.metadata;

    const result = await query<{ id: string }>(
      `INSERT INTO procedures (code, title, description, category, priority, estimated_time_min, required_roles, global_safety_instructions, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         priority = EXCLUDED.priority,
         estimated_time_min = EXCLUDED.estimated_time_min,
         required_roles = EXCLUDED.required_roles,
         global_safety_instructions = EXCLUDED.global_safety_instructions,
         metadata_json = EXCLUDED.metadata_json,
         updated_at = NOW()
       RETURNING id`,
      [
        metadata.code,
        metadata.title,
        metadata.description || null,
        metadata.category,
        metadata.priority,
        metadata.estimatedTimeMinutes,
        metadata.requiredRoles,
        metadata.globalSafetyInstructions,
        JSON.stringify(metadata),
      ],
    );

    const procedureId = result.rows[0].id;

    await query("DELETE FROM procedure_steps WHERE procedure_id = $1", [
      procedureId,
    ]);

    for (const step of procedure.steps) {
      await query(
        `INSERT INTO procedure_steps (procedure_id, step_order, step_id, title, subtitle, instructions, step_type, is_mandatory, dependencies, media_requirements, alarms, attachments, timer_enabled, timer_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          procedureId,
          step.order,
          step.id,
          step.title,
          step.subtitle || null,
          step.instructions,
          step.type,
          step.isMandatory,
          step.dependencies,
          JSON.stringify(step.mediaRequirements),
          JSON.stringify(step.alarms),
          step.attachments,
          step.timerEnabled,
          step.timerSeconds,
        ],
      );
    }

    console.log(`  ✓ Procédure ${metadata.code} — ${metadata.title}`);
  }

  console.log(`✅ ${mockProcedures.length} procédures seedées`);
}

export async function seedChromaIndex(): Promise<void> {
  console.log("🌱 Seeding chroma index...");

  if (!fs.existsSync(CHROMA_INDEX_PATH)) {
    console.log("  ⚠ chroma-index.json non trouvé, skip");
    return;
  }

  const raw = fs.readFileSync(CHROMA_INDEX_PATH, "utf-8");
  const manifest = JSON.parse(raw);

  if (!manifest.items || !Array.isArray(manifest.items)) {
    console.log("  ⚠ Format chroma-index.json invalide, skip");
    return;
  }

  for (const item of manifest.items) {
    await query(
      `INSERT INTO chroma_index (collection, document_id, content, metadata_json)
       VALUES ($1, $2, $3, $4)`,
      [
        item.collection || "default",
        item.id ||
          `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        item.content || JSON.stringify(item),
        JSON.stringify(item.metadata || {}),
      ],
    );
  }

  console.log(`✅ ${manifest.items.length} items chroma seedés`);
}

export async function seedTeams(): Promise<void> {
  console.log("🌱 Seeding teams...");

  for (const team of teams) {
    const result = await query<{ id: number }>(
      `INSERT INTO teams (id, name, description, color, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         color = EXCLUDED.color,
         updated_at = NOW()
       RETURNING id`,
      [team.id, team.name, team.description, team.color],
    );

    const teamId = result.rows[0].id;

    await query("DELETE FROM team_members WHERE team_id = $1", [teamId]);

    for (const member of team.members_list) {
      await query(
        `INSERT INTO team_members (team_id, name, email, role, status, avatar, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          teamId,
          member.name,
          member.email,
          member.role,
          member.status,
          member.avatar,
        ],
      );
    }

    console.log(
      `  ✓ Équipe ${team.name} — ${team.members_list.length} membres`,
    );
  }

  console.log(`✅ ${teams.length} équipes seedées`);
}

export async function runSeed(): Promise<void> {
  console.log("🚀 Démarrage du seed...");
  await seedTeams();
  await seedProcedures();
  await seedChromaIndex();
  console.log("🎉 Seed terminé");
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
