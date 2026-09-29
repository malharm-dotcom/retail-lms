-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AssetChunk" (
    "assetId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "AssetChunk_pkey" PRIMARY KEY ("assetId","index")
);

-- AddForeignKey
ALTER TABLE "AssetChunk" ADD CONSTRAINT "AssetChunk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
