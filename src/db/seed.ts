import { loadEnvFile } from "node:process";
import { hash } from "bcryptjs";

try {
  loadEnvFile(".env");
} catch {
  // Environment variables may already be supplied by the deployment platform.
}

async function seed() {
  const { db, pool } = await import("./index");
  const {
    appSettings,
    bankAccounts,
    ledgerAccounts,
    parties,
    products,
    users,
    warehouses,
  } = await import("./schema");

  const username = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  }

  const passwordHash = await hash(password, 12);

  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        username,
        displayName: "Crown Administrator",
        passwordHash,
        role: "admin",
        mustChangePassword: true,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: "Crown Administrator",
          role: "admin",
          isActive: true,
          updatedAt: new Date(),
        },
      });

    const stockManagerPasswordHash = await hash("Stocker123!@", 12);
    await tx
      .insert(users)
      .values({
        username: "stockmanager",
        displayName: "Stock Manager",
        passwordHash: stockManagerPasswordHash,
        role: "inventory",
        mustChangePassword: false,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: "Stock Manager",
          passwordHash: stockManagerPasswordHash,
          role: "inventory",
          isActive: true,
          updatedAt: new Date(),
        },
      });

    await tx
      .insert(warehouses)
      .values({
        code: "MAIN",
        name: "Main Factory Store",
        isDefault: true,
      })
      .onConflictDoNothing();

    await tx
      .insert(bankAccounts)
      .values({
        name: "Factory Cash",
        isCashAccount: true,
        openingBalance: "0",
      })
      .onConflictDoNothing();

    await tx
      .insert(ledgerAccounts)
      .values([
        { code: "1000", name: "Cash and Bank", type: "asset", isSystem: true },
        {
          code: "1100",
          name: "Accounts Receivable",
          type: "asset",
          isSystem: true,
        },
        { code: "1200", name: "Inventory", type: "asset", isSystem: true },
        {
          code: "2000",
          name: "Accounts Payable",
          type: "liability",
          isSystem: true,
        },
        { code: "3000", name: "Owner Equity", type: "equity", isSystem: true },
        { code: "4000", name: "Sales Revenue", type: "revenue", isSystem: true },
        {
          code: "5000",
          name: "Cost of Goods Sold",
          type: "expense",
          isSystem: true,
        },
        {
          code: "5100",
          name: "Payroll Expense",
          type: "expense",
          isSystem: true,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(appSettings)
      .values([
        {
          key: "company",
          value: {
            name: "Crown Accumulator",
            subtitle: "Battery Management System",
            timezone: "Asia/Karachi",
            currency: "PKR",
          },
        },
        {
          key: "billing",
          value: {
            invoicePrefix: "INV",
            quotationPrefix: "QTN",
            defaultTaxRate: 0,
          },
        },
      ])
      .onConflictDoNothing();

    if (process.env.SEED_DEMO_DATA === "true") {
      await tx
        .insert(parties)
        .values([
          {
            name: "ABC Motors",
            contactPerson: "Ahmed Khan",
            phone: "0300-1234567",
            email: "ahmed@abcmotors.com",
            isCustomer: true,
          },
          {
            name: "Local Garage",
            contactPerson: "Hassan Sheikh",
            phone: "0333-9876543",
            email: "hassan@localgarage.com",
            isCustomer: true,
            isSupplier: true,
          },
          {
            name: "XYZ Suppliers",
            contactPerson: "Mohammad Ali",
            phone: "0321-7654321",
            email: "ali@xyzsuppliers.com",
            isSupplier: true,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(products)
        .values([
          {
            sku: "CR-12V-100",
            name: "Crown Battery 12V 100Ah",
            category: "Batteries",
            brand: "Crown",
            unit: "Pieces",
            salePrice: "25999",
            purchasePrice: "22000",
          },
          {
            sku: "SOLO-12V-80",
            name: "SOLO Battery 12V 80Ah",
            category: "Batteries",
            brand: "SOLO",
            unit: "Pieces",
            salePrice: "21999",
            purchasePrice: "18500",
          },
        ])
        .onConflictDoNothing();
    }
  });

  await pool.end();
  console.log(`Database seeded. Administrator username: ${username}`);
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
