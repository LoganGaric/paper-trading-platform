-- CreateTable
CREATE TABLE "simulator_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "currentIndices" JSONB NOT NULL,
    "playbackSpeedMs" INTEGER NOT NULL DEFAULT 3000,
    "bidAskSpreadBps" INTEGER NOT NULL DEFAULT 20,
    "feePerShare" DECIMAL(10,6) NOT NULL DEFAULT 0.005,
    "slippageBps" INTEGER NOT NULL DEFAULT 5,
    "maxPartialFillPct" DECIMAL(3,2) NOT NULL DEFAULT 0.30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulator_state_pkey" PRIMARY KEY ("id")
);
