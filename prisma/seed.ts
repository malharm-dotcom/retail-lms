import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const isProduction = process.env.APP_DEPLOY_ENV === "production";

function requiredSeedValue(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} is required when APP_DEPLOY_ENV=production`);
  return fallback;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const adminCode = requiredSeedValue("SEED_ADMIN_CODE", "ADMIN001").trim().toUpperCase();
  const adminName = requiredSeedValue("SEED_ADMIN_NAME", "Retail LMS Admin").trim();
  const adminPassword = requiredSeedValue("SEED_ADMIN_PASSWORD", "ChangeMe@123");

  const admin = await prisma.user.upsert({
    where: { employeeCode: adminCode },
    update: { name: adminName, active: true, role: "SUPER_ADMIN" },
    create: {
      employeeCode: adminCode,
      name: adminName,
      passwordHash: await hash(adminPassword, 12),
      role: "SUPER_ADMIN",
      active: true,
      forcePasswordChange: false,
    },
  });

  if (isProduction) return;

  const store = await prisma.store.upsert({
    where: { code: "STORE001" },
    update: { name: "Indiranagar", active: true },
    create: { code: "STORE001", name: "Indiranagar" },
  });

  const department = await prisma.department.upsert({
    where: { code: "RETAIL" },
    update: { name: "Retail Operations", active: true },
    create: { code: "RETAIL", name: "Retail Operations" },
  });

  const employee = await prisma.user.upsert({
    where: { employeeCode: "EMP001" },
    update: { active: true, storeId: store.id, departmentId: department.id },
    create: {
      employeeCode: "EMP001",
      name: "Sample Employee",
      email: "employee@example.com",
      passwordHash: await hash("Learn@123", 12),
      role: "EMPLOYEE",
      active: true,
      forcePasswordChange: false,
      storeId: store.id,
      departmentId: department.id,
    },
  });

  const trainingModule = await prisma.trainingModule.upsert({
    where: { slug: "store-opening-standards" },
    update: { status: "PUBLISHED" },
    create: {
      slug: "store-opening-standards",
      title: "Store opening standards",
      description: "Daily opening checks, customer readiness, and safety basics.",
      status: "PUBLISHED",
    },
  });

  const moduleVersion = await prisma.moduleVersion.upsert({
    where: { moduleId_version: { moduleId: trainingModule.id, version: 1 } },
    update: { status: "PUBLISHED" },
    create: {
      moduleId: trainingModule.id,
      version: 1,
      title: trainingModule.title,
      description: trainingModule.description,
      status: "PUBLISHED",
      policyStatement: "I confirm that I have understood the store opening standards.",
      publishedAt: new Date(),
    },
  });

  const section = await prisma.section.upsert({
    where: { moduleVersionId_position: { moduleVersionId: moduleVersion.id, position: 1 } },
    update: { title: "Opening the store" },
    create: { moduleVersionId: moduleVersion.id, title: "Opening the store", position: 1 },
  });

  await prisma.lesson.upsert({
    where: { sectionId_position: { sectionId: section.id, position: 1 } },
    update: {},
    create: {
      sectionId: section.id,
      title: "Before customers arrive",
      type: "RICH_TEXT",
      position: 1,
      body: "Complete the opening checklist, confirm visual merchandising, and report safety exceptions before opening.",
    },
  });

  await prisma.lesson.upsert({
    where: { sectionId_position: { sectionId: section.id, position: 2 } },
    update: {},
    create: {
      sectionId: section.id,
      title: "Customer readiness walkthrough",
      type: "VIDEO",
      position: 2,
      youtubeVideoId: "dQw4w9WgXcQ",
      videoDurationSeconds: 213,
      requiredWatchPercentage: 95,
    },
  });

  const quiz = await prisma.quiz.upsert({
    where: { moduleVersionId: moduleVersion.id },
    update: { passingScore: 80 },
    create: { moduleVersionId: moduleVersion.id, title: "Opening standards check", passingScore: 80 },
  });

  const question = await prisma.question.upsert({
    where: { quizId_position: { quizId: quiz.id, position: 1 } },
    update: {},
    create: {
      quizId: quiz.id,
      position: 1,
      prompt: "When must safety exceptions be reported?",
      type: "SINGLE_CHOICE",
    },
  });

  await prisma.questionOption.upsert({
    where: { questionId_position: { questionId: question.id, position: 1 } },
    update: {},
    create: { questionId: question.id, position: 1, label: "Before the store opens", isCorrect: true },
  });

  await prisma.questionOption.upsert({
    where: { questionId_position: { questionId: question.id, position: 2 } },
    update: {},
    create: { questionId: question.id, position: 2, label: "At the end of the week", isCorrect: false },
  });

  let assignment = await prisma.assignment.findFirst({
    where: { moduleVersionId: moduleVersion.id, target: "ALL_EMPLOYEES" },
  });

  assignment ??= await prisma.assignment.create({
    data: {
      moduleVersionId: moduleVersion.id,
      target: "ALL_EMPLOYEES",
      mandatory: true,
      createdById: admin.id,
    },
  });

  await prisma.enrollment.upsert({
    where: { assignmentId_userId: { assignmentId: assignment.id, userId: employee.id } },
    update: {},
    create: { assignmentId: assignment.id, userId: employee.id },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
