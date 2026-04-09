const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("crypto");

const prisma = new PrismaClient();

async function main() {
  const hashSecret = (secret) => {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(secret, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  };

  const superEmail = (process.env.SUPER_ADMIN_EMAIL || "owner@postrend.local").trim().toLowerCase();
  const superPassword = process.env.SUPER_ADMIN_PASSWORD || "Owner123!";
  const superAdmins = await prisma.superAdminUser.findMany();
  const existingSa = superAdmins.find((u) => u.email.toLowerCase() === superEmail);
  if (existingSa) {
    await prisma.superAdminUser.update({
      where: { id: existingSa.id },
      data: {
        email: superEmail,
        passwordHash: hashSecret(superPassword),
        status: "active",
        fullName: "Platform Owner"
      }
    });
  } else {
    await prisma.superAdminUser.create({
      data: {
        email: superEmail,
        fullName: "Platform Owner",
        passwordHash: hashSecret(superPassword),
        status: "active"
      }
    });
  }

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: "starter" },
    create: {
      code: "starter",
      name: "Starter",
      trialDays: 14,
      maxConcepts: 3,
      maxBranches: 5,
      maxDevices: 20,
      maxUsers: 30,
      isActive: true
    },
    update: {}
  });

  const existingDemo = await prisma.tenant.findFirst({ where: { slug: "demo-foods" } });
  if (existingDemo) {
    console.log({
      super_admin_email: superEmail,
      tenant_id: existingDemo.id,
      note: "Demo tenant already present; super admin password was reset above."
    });
    return;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: "Demo Foods",
      slug: "demo-foods",
      status: "active",
      plan: "starter",
      planId: starterPlan.id
    }
  });

  const concept = await prisma.concept.create({
    data: {
      tenantId: tenant.id,
      name: "Demo Burgers"
    }
  });

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      conceptId: concept.id,
      name: "Main Branch",
      timezone: "UTC"
    }
  });

  const category = await prisma.menuCategory.create({
    data: {
      tenantId: tenant.id,
      conceptId: concept.id,
      name: "Main",
      displayOrder: 1,
      isActive: true
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        tenantId: tenant.id,
        conceptId: concept.id,
        categoryId: category.id,
        name: "Classic Burger",
        basePrice: 8.5
      },
      {
        tenantId: tenant.id,
        conceptId: concept.id,
        categoryId: category.id,
        name: "Fries",
        basePrice: 3.0
      }
    ]
  });

  const pcsUom = await prisma.uom.create({
    data: { name: "pcs", conversionFactor: 1 }
  });
  const kgUom = await prisma.uom.create({
    data: { name: "kg", conversionFactor: 1 }
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        tenantId: tenant.id,
        conceptId: concept.id,
        branchId: branch.id,
        name: "Beef Patty",
        sku: "BEEF-PATTY",
        uomId: pcsUom.id,
        stockLevel: 500,
        reorderPoint: 100
      },
      {
        tenantId: tenant.id,
        conceptId: concept.id,
        branchId: branch.id,
        name: "Potato",
        sku: "POTATO",
        uomId: kgUom.id,
        stockLevel: 100,
        reorderPoint: 20
      }
    ]
  });

  const burger = await prisma.menuItem.findFirst({
    where: { tenantId: tenant.id, conceptId: concept.id, name: "Classic Burger" }
  });
  const patty = await prisma.inventoryItem.findFirst({
    where: { tenantId: tenant.id, conceptId: concept.id, sku: "BEEF-PATTY" }
  });
  if (burger && patty) {
    const recipe = await prisma.recipe.create({
      data: {
        menuItemId: burger.id,
        tenantId: tenant.id,
        conceptId: concept.id,
        branchId: branch.id
      }
    });
    await prisma.recipeLine.create({
      data: {
        recipeId: recipe.id,
        inventoryItemId: patty.id,
        qtyPerItem: 1
      }
    });
  }

  console.log({
    tenant_id: tenant.id,
    concept_id: concept.id,
    branch_id: branch.id
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
