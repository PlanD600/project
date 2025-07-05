/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Project` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_ownerId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "ownerId";

-- CreateTable
CREATE TABLE "_ProjectTeamLeaders" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectTeamLeaders_AB_unique" ON "_ProjectTeamLeaders"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectTeamLeaders_B_index" ON "_ProjectTeamLeaders"("B");

-- AddForeignKey
ALTER TABLE "_ProjectTeamLeaders" ADD CONSTRAINT "_ProjectTeamLeaders_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTeamLeaders" ADD CONSTRAINT "_ProjectTeamLeaders_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
