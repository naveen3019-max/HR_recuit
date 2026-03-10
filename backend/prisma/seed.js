import bcrypt from "bcryptjs";
import prisma from "../config/db.js";

const defaultStages = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected"
];

async function main() {
  for (let i = 0; i < defaultStages.length; i += 1) {
    await prisma.recruitmentStage.upsert({
      where: { name: defaultStages[i] },
      update: {},
      create: { name: defaultStages[i], orderIndex: i + 1 }
    });
  }

  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@hrcrm.local" }
  });

  if (!adminExists) {
    const password = await bcrypt.hash("Admin@12345", 10);
    await prisma.user.create({
      data: {
        name: "System Admin",
        email: "admin@hrcrm.local",
        password,
        role: "admin"
      }
    });
  }

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
