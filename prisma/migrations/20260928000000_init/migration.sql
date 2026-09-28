-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'HR_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'PDF', 'RICH_TEXT');

-- CreateEnum
CREATE TYPE "AssignmentTarget" AS ENUM ('ALL_EMPLOYEES', 'STORE', 'DEPARTMENT', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "storeId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleVersion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "policyStatement" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "position" INTEGER NOT NULL,
    "body" TEXT,
    "sourceUrl" TEXT,
    "youtubeVideoId" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "videoDurationSeconds" INTEGER,
    "requiredWatchPercentage" INTEGER NOT NULL DEFAULT 95,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 80,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "target" "AssignmentTarget" NOT NULL,
    "storeId" TEXT,
    "departmentId" TEXT,
    "targetUserId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acknowledgement" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmployeeCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_storeId_active_idx" ON "User"("storeId", "active");

-- CreateIndex
CREATE INDEX "User_departmentId_active_idx" ON "User"("departmentId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModule_slug_key" ON "TrainingModule"("slug");

-- CreateIndex
CREATE INDEX "ModuleVersion_status_publishedAt_idx" ON "ModuleVersion"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleVersion_moduleId_version_key" ON "ModuleVersion"("moduleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Section_moduleVersionId_position_key" ON "Section"("moduleVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_sectionId_position_key" ON "Lesson"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_moduleVersionId_key" ON "Quiz"("moduleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_quizId_position_key" ON "Question"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_position_key" ON "QuestionOption"("questionId", "position");

-- CreateIndex
CREATE INDEX "Assignment_moduleVersionId_idx" ON "Assignment"("moduleVersionId");

-- CreateIndex
CREATE INDEX "Assignment_target_dueDate_idx" ON "Assignment"("target", "dueDate");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_assignmentId_userId_key" ON "Enrollment"("assignmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_enrollmentId_lessonId_key" ON "LessonProgress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "QuizAttempt_enrollmentId_completedAt_idx" ON "QuizAttempt"("enrollmentId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgement_enrollmentId_key" ON "Acknowledgement"("enrollmentId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleVersion" ADD CONSTRAINT "ModuleVersion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
