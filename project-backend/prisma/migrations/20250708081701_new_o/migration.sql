-- AlterTable
ALTER TABLE "_ProjectTeamLeaders" ADD CONSTRAINT "_ProjectTeamLeaders_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ProjectTeamLeaders_AB_unique";

-- AlterTable
ALTER TABLE "_TaskToUser" ADD CONSTRAINT "_TaskToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_TaskToUser_AB_unique";
