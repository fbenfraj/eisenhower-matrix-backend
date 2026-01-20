-- CreateEnum
CREATE TYPE "Quadrant" AS ENUM ('URGENT_IMPORTANT', 'NOT_URGENT_IMPORTANT', 'URGENT_NOT_IMPORTANT', 'NOT_URGENT_NOT_IMPORTANT');

-- CreateEnum
CREATE TYPE "Complexity" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "quadrant" "Quadrant" NOT NULL,
    "complexity" "Complexity",
    "showAfter" TIMESTAMP(3),
    "recurrence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_quadrant_idx" ON "Task"("quadrant");

-- CreateIndex
CREATE INDEX "Task_completed_idx" ON "Task"("completed");
