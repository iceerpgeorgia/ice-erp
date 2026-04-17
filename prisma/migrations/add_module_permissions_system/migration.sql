-- CreateTable
CREATE TABLE "Module" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "route" VARCHAR(255),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleFeature" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" BIGINT NOT NULL,
    "module_uuid" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "feature_type" VARCHAR(50) NOT NULL DEFAULT 'action',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "module_feature_id" BIGINT NOT NULL,
    "module_feature_uuid" UUID NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" VARCHAR(50) NOT NULL,
    "module_feature_id" BIGINT NOT NULL,
    "module_feature_uuid" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_uuid_key" ON "Module"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");

-- CreateIndex
CREATE INDEX "Module_is_active_idx" ON "Module"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleFeature_uuid_key" ON "ModuleFeature"("uuid");

-- CreateIndex
CREATE INDEX "ModuleFeature_module_id_idx" ON "ModuleFeature"("module_id");

-- CreateIndex
CREATE INDEX "ModuleFeature_module_uuid_idx" ON "ModuleFeature"("module_uuid");

-- CreateIndex
CREATE INDEX "ModuleFeature_is_active_idx" ON "ModuleFeature"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleFeature_module_id_key_key" ON "ModuleFeature"("module_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_uuid_key" ON "UserPermission"("uuid");

-- CreateIndex
CREATE INDEX "UserPermission_user_id_idx" ON "UserPermission"("user_id");

-- CreateIndex
CREATE INDEX "UserPermission_module_feature_id_idx" ON "UserPermission"("module_feature_id");

-- CreateIndex
CREATE INDEX "UserPermission_is_active_idx" ON "UserPermission"("is_active");

-- CreateIndex
CREATE INDEX "UserPermission_expires_at_idx" ON "UserPermission"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_user_id_module_feature_id_key" ON "UserPermission"("user_id", "module_feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_uuid_key" ON "RolePermission"("uuid");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_module_feature_id_idx" ON "RolePermission"("module_feature_id");

-- CreateIndex
CREATE INDEX "RolePermission_is_active_idx" ON "RolePermission"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_module_feature_id_key" ON "RolePermission"("role", "module_feature_id");

-- AddForeignKey
ALTER TABLE "ModuleFeature" ADD CONSTRAINT "ModuleFeature_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_module_feature_id_fkey" FOREIGN KEY ("module_feature_id") REFERENCES "ModuleFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_module_feature_id_fkey" FOREIGN KEY ("module_feature_id") REFERENCES "ModuleFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
