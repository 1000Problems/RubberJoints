import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { exercises, supplements, milestones, program, programTemplate } from "./seed-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Exercises
  await prisma.exercise.createMany({ data: exercises, skipDuplicates: true });
  console.log(`Seeded ${exercises.length} exercises`);

  // Supplements
  await prisma.supplement.createMany({ data: supplements, skipDuplicates: true });
  console.log(`Seeded ${supplements.length} supplements`);

  // Milestones
  await prisma.milestone.createMany({ data: milestones, skipDuplicates: true });
  console.log(`Seeded ${milestones.length} milestones`);

  // Program
  const existingProgram = await prisma.program.findFirst({ where: { name: program.name } });
  if (!existingProgram) {
    const created = await prisma.program.create({ data: program });
    console.log(`Created program: ${created.name}`);

    // Program template
    await prisma.programTemplate.createMany({
      data: programTemplate.map((t) => ({ ...t, programId: created.id })),
    });
    console.log(`Seeded ${programTemplate.length} program template entries`);
  } else {
    console.log(`Program already exists: ${existingProgram.name}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
