-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE', 'MANAGER', 'SUCCESSOR', 'MENTOR');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('HANDOVER', 'ONBOARDING', 'BOTH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'INGESTING', 'GENERATED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GITHUB_REPO', 'GITHUB_ISSUE', 'NOTION_PAGE');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitionTask" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "successorUserId" TEXT,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "sourceSelection" JSONB,
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnection" (
    "id" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "configJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "author" TEXT,
    "createdAtSource" TIMESTAMP(3),
    "rawContent" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverDraft" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "structuredJson" JSONB NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingPack" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "structuredJson" JSONB NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handoverDraftId" TEXT,
    "onboardingPackId" TEXT,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "onboardingPackId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "mentorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "detailsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "transitionTaskId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SourceItem_transitionTaskId_idx" ON "SourceItem"("transitionTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverDraft_transitionTaskId_version_key" ON "HandoverDraft"("transitionTaskId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingPack_transitionTaskId_version_key" ON "OnboardingPack"("transitionTaskId", "version");

-- CreateIndex
CREATE INDEX "Citation_documentType_documentId_idx" ON "Citation"("documentType", "documentId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_runAfter_idx" ON "GenerationJob"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "TransitionTask" ADD CONSTRAINT "TransitionTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverDraft" ADD CONSTRAINT "HandoverDraft_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingPack" ADD CONSTRAINT "OnboardingPack_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_handoverDraftId_fkey" FOREIGN KEY ("handoverDraftId") REFERENCES "HandoverDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_onboardingPackId_fkey" FOREIGN KEY ("onboardingPackId") REFERENCES "OnboardingPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_onboardingPackId_fkey" FOREIGN KEY ("onboardingPackId") REFERENCES "OnboardingPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_transitionTaskId_fkey" FOREIGN KEY ("transitionTaskId") REFERENCES "TransitionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
