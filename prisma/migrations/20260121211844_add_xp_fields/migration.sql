-- CreateEnum
CREATE TYPE "SuggestionSourceType" AS ENUM ('S1_RECURRENCE', 'S2_FOLLOW_UP', 'S3_LATE_ADDITION', 'S4_DEPENDENCY', 'S5_MAINTENANCE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SNOOZED', 'DISMISSED', 'NEVER');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "aiScores" JSONB,
ADD COLUMN     "xp" INTEGER;

-- CreateTable
CREATE TABLE "SuggestedTask" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "suggestedText" VARCHAR(500) NOT NULL,
    "sourceType" "SuggestionSourceType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "why" VARCHAR(500) NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" VARCHAR(64) NOT NULL,
    "relatedTaskIds" INTEGER[],
    "snoozeUntil" TIMESTAMP(3),
    "lastShownAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestedTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestedTask_userId_status_idx" ON "SuggestedTask"("userId", "status");

-- CreateIndex
CREATE INDEX "SuggestedTask_userId_fingerprint_idx" ON "SuggestedTask"("userId", "fingerprint");

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
