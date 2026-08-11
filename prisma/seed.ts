import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mockProcedures } from "@/lib/procedures/mock-data";
import { teams } from "@/data/teams";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

function generateId(): string {
  return crypto.randomUUID();
}

export async function seedProcedures(): Promise<void> {
  console.log("🌱 Seeding procedures...");

  for (const procedure of mockProcedures) {
    const metadata = procedure.metadata;

    await prisma.procedure.upsert({
      where: { code: metadata.code },
      update: {
        title: metadata.title,
        description: metadata.description || null,
        category: metadata.category,
        priority: metadata.priority,
        estimatedTimeMin: metadata.estimatedTimeMinutes,
        requiredRoles: metadata.requiredRoles,
        globalSafetyInstructions: metadata.globalSafetyInstructions,
        metadataJson: metadata,
      },
      create: {
        id: generateId(),
        code: metadata.code,
        title: metadata.title,
        description: metadata.description || null,
        category: metadata.category,
        priority: metadata.priority,
        estimatedTimeMin: metadata.estimatedTimeMinutes,
        requiredRoles: metadata.requiredRoles,
        globalSafetyInstructions: metadata.globalSafetyInstructions,
        metadataJson: metadata,
      },
    });

    const proc = await prisma.procedure.findUnique({
      where: { code: metadata.code },
    });

    if (!proc) {
      throw new Error(`Procedure ${metadata.code} not found after upsert`);
    }

    await prisma.procedureStep.deleteMany({
      where: { procedureId: proc.id },
    });

    for (const step of procedure.steps) {
      await prisma.procedureStep.create({
        data: {
          id: generateId(),
          procedureId: proc.id,
          stepOrder: step.order,
          stepId: step.id,
          title: step.title,
          subtitle: step.subtitle || null,
          instructions: step.instructions,
          stepType: step.type,
          isMandatory: step.isMandatory,
          dependencies: step.dependencies,
          mediaRequirements: step.mediaRequirements,
          alarms: step.alarms,
          alarmCodes: step.alarmCodes,
          attachments: step.attachments,
          timerEnabled: step.timerEnabled,
          timerSeconds: step.timerSeconds,
        },
      });
    }

    console.log(`  ✓ Procédure ${metadata.code} — ${metadata.title}`);
  }

  console.log(`✅ ${mockProcedures.length} procédures seedées`);
}

export async function seedTeams(): Promise<void> {
  console.log("🌱 Seeding teams...");

  await prisma.team.deleteMany();

  for (const team of teams) {
    await prisma.team.create({
      data: {
        name: team.name,
        description: team.description,
        color: team.color,
        members: {
          create: team.members_list.map((member) => ({
            name: member.name,
            email: member.email,
            role: member.role,
            status: member.status,
            avatar: member.avatar,
          })),
        },
      },
    });

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
