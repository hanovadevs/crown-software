import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { parties, products, transactions, users } from "../src/db/schema";
import { nextDocumentNumber } from "../src/db/documents";

async function main() {
  console.log("🚀 Seeding FAWAD BATTERY WIRE party and ledger transactions...");

  // 1. Get first active user for createdBy reference
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    throw new Error("No users found in database. Please log in or create a user first.");
  }
  const userId = existingUsers[0].id;
  console.log(`👤 Using user ID: ${userId} (${existingUsers[0].username})`);

  // 2. Ensure product "WIRE BATTERY" exists
  let product = (
    await db.select().from(products).where(eq(products.name, "WIRE BATTERY")).limit(1)
  )[0];

  if (!product) {
    const [newProd] = await db
      .insert(products)
      .values({
        sku: "WIRE-BAT-001",
        name: "WIRE BATTERY",
        category: "Battery Accessories",
        unit: "NO's",
        salePrice: "14.50",
        purchasePrice: "10.00",
        isSellable: true,
      })
      .returning();
    product = newProd;
    console.log(`📦 Created product: WIRE BATTERY (${product.id})`);
  } else {
    console.log(`📦 Found existing product: WIRE BATTERY (${product.id})`);
  }

  // 3. Create or find Party: FAWAD BATTERY WIRE
  const partyName = "FAWAD BATTERY WIRE";
  let party = (
    await db.select().from(parties).where(eq(parties.name, partyName)).limit(1)
  )[0];

  if (!party) {
    const [newParty] = await db
      .insert(parties)
      .values({
        name: partyName,
        contactPerson: "FAWAD AHMED",
        phone: "03014707279",
        address: "LAHORE",
        taxNumber: "12345-6789000-0",
        isCustomer: true,
        isSupplier: false,
        openingReceivable: "6400", // BF (Brought Forward)
        openingPayable: "0",
      })
      .returning();
    party = newParty;
    console.log(`🏢 Created Party: ${partyName} (${party.id})`);
  } else {
    console.log(`🏢 Found existing Party: ${partyName} (${party.id})`);
  }

  // 4. Define all transactions from the spreadsheet image
  const items = [
    { type: "sale", qty: "2000", rate: "14.5", amount: "29000", date: "2024-01-08", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "35400", date: "2024-01-24", desc: "PAID CHEQ BAL # 50377128", method: "cheque" },
    { type: "sale", qty: "2000", rate: "14.5", amount: "29000", date: "2024-02-02", desc: "WIRE BATTERY", method: "cash" },
    { type: "sale", qty: "1000", rate: "14.5", amount: "14500", date: "2024-02-13", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "50000", date: "2024-02-19", desc: "ONLINE MBL CR", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-02-20", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "29700", date: "2024-03-02", desc: "ONLINE MBL CR", method: "bank" },
    { type: "customer_receipt", amount: "34000", date: "2024-03-08", desc: "CASH ASGHAR SB", method: "cash" },
    { type: "sale", qty: "2400", rate: "14.5", amount: "34800", date: "2024-03-08", desc: "WIRE BATTERY", method: "cash" },
    { type: "sale", qty: "2000", rate: "14.5", amount: "29000", date: "2024-03-22", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "29850", date: "2024-04-01", desc: "ONLINE MBL CR", method: "bank" },
    { type: "sale", qty: "2000", rate: "14.5", amount: "29000", date: "2024-04-03", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "15000", date: "2024-04-06", desc: "ONLINE MBL CR", method: "bank" },
    { type: "customer_receipt", amount: "14000", date: "2024-04-29", desc: "ONLINE MBL CR", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-05-10", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "36250", date: "2024-05-22", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-05-31", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "36250", date: "2024-06-10", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-06-11", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "20000", date: "2024-06-15", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "customer_receipt", amount: "16250", date: "2024-06-27", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-07-07", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "20000", date: "2024-07-16", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "customer_receipt", amount: "16250", date: "2024-07-23", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-07-25", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "20000", date: "2024-08-06", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "customer_receipt", amount: "16250", date: "2024-08-10", desc: "TRANSFER ONLINE MBL", method: "bank" },
    { type: "sale", qty: "2500", rate: "14.5", amount: "36250", date: "2024-08-12", desc: "WIRE BATTERY", method: "cash" },
    { type: "customer_receipt", amount: "36250", date: "2026-08-10", desc: "TRANSFER ONLINE MBL", method: "bank" },
  ] as const;

  console.log(`📝 Inserting ${items.length} ledger transactions...`);

  await db.transaction(async (tx) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as { type: string; amount: string; date: string; desc: string; method: string; qty?: string; rate?: string };
      const seqKey = item.type === "sale" ? "tx-sales" : "tx-receipt";
      const prefix = item.type === "sale" ? "SL" : "RC";
      const txNumber = await nextDocumentNumber(tx, seqKey, prefix, new Date(item.date));

      await tx.insert(transactions).values({
        transactionNumber: txNumber,
        partyId: party.id,
        productId: item.type === "sale" ? product.id : null,
        type: item.type as "sale" | "customer_receipt",
        status: "posted",
        paymentMethod: item.method as "cash" | "bank" | "cheque",
        quantity: item.qty ? item.qty : null,
        unitPrice: item.rate ? item.rate : null,
        totalAmount: item.amount,
        description: item.desc,
        transactionDate: item.date,
        createdBy: userId,
      });
    }
  });

  console.log("✅ Successfully seeded FAWAD BATTERY WIRE party and all 29 ledger transactions into database!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
