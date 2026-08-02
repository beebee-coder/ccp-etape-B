import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  const adminFirstName = process.env.AUTH_ADMIN_FIRST_NAME ?? "ahmed";
  const adminLastName = process.env.AUTH_ADMIN_LAST_NAME ?? "abbes";
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? "admin123";
  const adminEmail = `${adminFirstName}@visionode.local`;

  const passwordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: adminFirstName,
      lastName: adminLastName,
      password: passwordHash,
      role: "admin",
      approved: true,
      updatedAt: new Date(),
    },
    create: {
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      password: passwordHash,
      role: "admin",
      approved: true,
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Admin user created: ${adminUser.email} (id: ${adminUser.id})`);

  const procedure = await prisma.procedure.upsert({
    where: { code: "CRF-START-001" },
    update: {
      title: "Démarrage du système de filtration CRF",
      description:
        "Procédure de démarrage sécurisé du système de filtration CRF après maintenance ou arrêt prolongé.",
      category: "production",
      criticality: "NORMAL",
      status: "DRAFT",
      prerequisites: [],
      steps: [
        {
          stepId: "step_1",
          title: "Vérification préalable",
          instructions:
            "Inspecter l'ensemble des filtres, joints et raccords. Vérifier que les vannes d'isolement sont en position fermée.",
          type: "inspection_visuelle",
          isMandatory: true,
          dependencies: [],
        },
        {
          stepId: "step_2",
          title: "Ouverture des vannes d'alimentation",
          instructions:
            "Ouvrir lentement la vanne d'alimentation principale. Surveiller les manomètres.",
          type: "consigne_simple",
          isMandatory: true,
          dependencies: ["step_1"],
        },
      ],
      authorId: adminUser.id,
      updatedAt: new Date(),
    },
    create: {
      code: "CRF-START-001",
      title: "Démarrage du système de filtration CRF",
      description:
        "Procédure de démarrage sécurisé du système de filtration CRF après maintenance ou arrêt prolongé.",
      category: "production",
      criticality: "NORMAL",
      status: "PUBLIC",
      prerequisites: [],
      steps: [
        {
          stepId: "step_1",
          title: "Vérification préalable",
          instructions:
            "Inspecter l'ensemble des filtres, joints et raccords. Vérifier que les vannes d'isolement sont en position fermée.",
          type: "inspection_visuelle",
          isMandatory: true,
          dependencies: [],
        },
        {
          stepId: "step_2",
          title: "Ouverture des vannes d'alimentation",
          instructions:
            "Ouvrir lentement la vanne d'alimentation principale. Surveiller les manomètres.",
          type: "consigne_simple",
          isMandatory: true,
          dependencies: ["step_1"],
        },
      ],
      authorId: adminUser.id,
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Procedure created: ${procedure.code} (id: ${procedure.id})`);

  const knowledgeItem = await prisma.knowledge_items.create({
    data: {
      id: "ki_crf_basics",
      userId: adminUser.id,
      type: "guide",
      title: "Fonctionnement de base du système CRF",
      question: "Comment fonctionne le système de filtration CRF?",
      answer:
        "Le système CRF (Carbon Filter Recirculation) permet de recycler l'air en utilisant des filtres à charbon actif. Il est divisé en trois zones: pré-filtration, filtration principale et post-filtration.",
      tags: ["crf", "filtration", "air", "sécurité"],
      category: "production",
      content: "Le système CRF est composé de filtres à charbon actif qui capturent les impuretés de l'air recyclé.",
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Knowledge item created: ${knowledgeItem.title} (id: ${knowledgeItem.id})`);

  console.log("🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
