import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { parties, products, transactions, users } from "../src/db/schema";
import { nextDocumentNumber } from "../src/db/documents";

async function main() {
  console.log("🚀 Seeding NEW SUPER SINDH BATTERY SERVICE party, products, and ledger transactions...");

  // 1. Get active user for createdBy reference
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    throw new Error("No users found in database.");
  }
  const userId = existingUsers[0].id;
  console.log(`👤 Using user ID: ${userId} (${existingUsers[0].username})`);

  // 2. Define products list to ensure they exist
  const productList = [
    { name: "PLATE P+VE SPECIAL", sku: "PLT-PVE-SPC", price: "68" },
    { name: "PLATE P+VE DIP 170 GM REG", sku: "PLT-PVE-170G", price: "66" },
    { name: "PLATE 2HN P+VE DIP 125 GM REG", sku: "PLT-2HN-125G", price: "50" },
    { name: "PLATE +VE STANDERD (DIP)", sku: "PLT-PVE-STD", price: "68" },
    { name: "PLATE +VE 2HN (SP)", sku: "PLT-2HN-SP", price: "52" },
    { name: "PLATE 2HN P+VE SP (DIP)", sku: "PLT-2HN-PVE-SP", price: "52" },
    { name: "PLATE SHALIMAR (GREY)", sku: "PLT-SHALIMAR-GRY", price: "70" },
    { name: "PLATE 2HN DIP", sku: "PLT-2HN-DIP", price: "75" },
    { name: "PLATE SUPER SHALIMAR", sku: "PLT-SPR-SHALIMAR", price: "148" },
    { name: "PLATE KHYBER 17KG", sku: "PLT-KHYBER-17KG", price: "130" },
    { name: "PLATE KHYBER 15KG", sku: "PLT-KHYBER-15KG", price: "110" },
    { name: "PLATE KHYBER 2HN", sku: "PLT-KHYBER-2HN", price: "74" },
    { name: "PLATE KHYBER 12.5KG", sku: "PLT-KHYBER-12.5KG", price: "93" },
    { name: "PLATE KHYBER 170gm DIP", sku: "PLT-KHYBER-170G", price: "132" },
    { name: "PLATE 2HN (120g) DIP", sku: "PLT-2HN-120G", price: "90" },
    { name: "PLATE KHYBER(210g)CHARG", sku: "PLT-KHYBER-210G", price: "140" },
  ];

  const productMap = new Map<string, string>();

  for (const prodItem of productList) {
    let prod = (
      await db.select().from(products).where(eq(products.name, prodItem.name)).limit(1)
    )[0];

    if (!prod) {
      const [newP] = await db
        .insert(products)
        .values({
          sku: prodItem.sku,
          name: prodItem.name,
          category: "Battery Plates",
          unit: "NO's",
          salePrice: prodItem.price,
          purchasePrice: "50.00",
          isSellable: true,
        })
        .returning();
      prod = newP;
      console.log(`📦 Created Product: ${prodItem.name} (${prod.id})`);
    } else {
      console.log(`📦 Found Product: ${prodItem.name} (${prod.id})`);
    }
    productMap.set(prodItem.name, prod.id);
  }

  // 3. Create or find Party: NEW SUPER SINDH BATTERY SERVICE
  const partyName = "NEW SUPER SINDH BATTERY SERVICE";
  let party = (
    await db.select().from(parties).where(eq(parties.name, partyName)).limit(1)
  )[0];

  if (!party) {
    const [newParty] = await db
      .insert(parties)
      .values({
        name: partyName,
        contactPerson: "ALLAH WASAYA SB",
        phone: "03135464874",
        address: "BADAR CHOWK , ORANGI TOWN # 4 , KARACHI",
        taxNumber: "12345-6789000-0",
        isCustomer: true,
        isSupplier: false,
        openingReceivable: "0",
        openingPayable: "0",
      })
      .returning();
    party = newParty;
    console.log(`🏢 Created Party: ${partyName} (${party.id})`);
  } else {
    console.log(`🏢 Found Party: ${partyName} (${party.id})`);
  }

  // 4. Define all historical ledger transactions across 2021, 2022, 2023, 2024
  const items = [
    // 2021
    { date: "2021-07-28", type: "sale", prod: "PLATE P+VE SPECIAL", qty: "1450", rate: "68", amount: "98600", desc: "PLATE P+VE SPECIAL", method: "cash" },
    { date: "2021-07-28", type: "customer_receipt", amount: "98600", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-08-02", type: "sale", prod: "PLATE P+VE DIP 170 GM REG", qty: "1500", rate: "66", amount: "99000", desc: "PLATE P+VE DIP 170 GM REG", method: "cash" },
    { date: "2021-08-02", type: "sale", prod: "PLATE 2HN P+VE DIP 125 GM REG", qty: "1043", rate: "50", amount: "52150", desc: "PLATE 2HN P+VE DIP 125 GM REG", method: "cash" },
    { date: "2021-08-03", type: "customer_receipt", amount: "151150", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-08-05", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "980", rate: "68", amount: "66640", desc: "PLATE +VE STANDERD (DIP)", method: "cash" },
    { date: "2021-08-05", type: "sale", prod: "PLATE +VE 2HN (SP)", qty: "699", rate: "52", amount: "36348", desc: "PLATE +VE 2HN (SP)", method: "cash" },
    { date: "2021-09-08", type: "customer_receipt", amount: "100000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-09-11", type: "sale", prod: "PLATE +VE 2HN (SP)", qty: "2250", rate: "52", amount: "117000", desc: "PLATE +VE 2HN (SP)", method: "cash" },
    { date: "2021-09-11", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "1860", rate: "68", amount: "126480", desc: "PLATE +VE STANDERD (DIP)", method: "cash" },
    { date: "2021-09-13", type: "customer_receipt", amount: "246000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-10-06", type: "sale", prod: "PLATE 2HN P+VE SP (DIP)", qty: "900", rate: "52", amount: "46800", desc: "PLATE 2HN P+VE SP (DIP)", method: "cash" },
    { date: "2021-10-06", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "980", rate: "68", amount: "66640", desc: "PLATE STANDERD +VE (DIP)", method: "cash" },
    { date: "2021-10-07", type: "customer_receipt", amount: "113900", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-10-14", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "2188", rate: "68", amount: "148784", desc: "PLATE STANDERD +VE (DIP)", method: "cash" },
    { date: "2021-10-14", type: "sale", prod: "PLATE 2HN P+VE SP (DIP)", qty: "2105", rate: "52", amount: "109460", desc: "PLATE 2HN P+VE SP (DIP)", method: "cash" },
    { date: "2021-10-15", type: "customer_receipt", amount: "258000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-11-05", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "3770", rate: "68", amount: "256360", desc: "PLATE STANDERD +VE (DIP)", method: "cash" },
    { date: "2021-11-16", type: "customer_receipt", amount: "250000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2021-11-24", type: "sale", prod: "PLATE 2HN P+VE SP (DIP)", qty: "1600", rate: "52", amount: "83200", desc: "PLATE 2HN P+VE SP (DIP)", method: "cash" },
    { date: "2021-11-24", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "430", rate: "68", amount: "29240", desc: "PLATE STANDERD +VE (DIP)", method: "cash" },
    { date: "2021-11-27", type: "customer_receipt", amount: "119000", desc: "RECEIVED ONLINE MBL", method: "bank" },

    // 2022
    { date: "2022-01-29", type: "sale", prod: "PLATE +VE STANDERD (DIP)", qty: "1560", rate: "70", amount: "109200", desc: "PLATE STANDERD +VE (DIP)", method: "cash" },
    { date: "2022-02-02", type: "customer_receipt", amount: "109200", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2022-03-17", type: "sale", prod: "PLATE SHALIMAR (GREY)", qty: "300", rate: "70", amount: "21000", desc: "PLATE SHALIMAR (GREY)", method: "cash" },
    { date: "2022-04-07", type: "customer_receipt", amount: "21000", desc: "RECEIVED ONLINE MBL", method: "bank" },

    // 2023
    { date: "2023-08-30", type: "sale", prod: "PLATE 2HN DIP", qty: "2003", rate: "75", amount: "150225", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-08-30", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1000", rate: "148", amount: "148000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2023-08-30", type: "customer_receipt", amount: "298000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-09-15", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1089", rate: "142", amount: "154638", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2023-09-15", type: "sale", prod: "PLATE KHYBER 17KG", qty: "999", rate: "130", amount: "129870", desc: "PLATE KHYBER 17KG", method: "cash" },
    { date: "2023-09-15", type: "sale", prod: "PLATE KHYBER 15KG", qty: "995", rate: "110", amount: "109450", desc: "PLATE KHYBER 15KG", method: "cash" },
    { date: "2023-09-15", type: "sale", prod: "PLATE KHYBER 2HN", qty: "2010", rate: "74", amount: "148740", desc: "PLATE KHYBER 2HN", method: "cash" },
    { date: "2023-09-15", type: "customer_receipt", amount: "250000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-09-16", type: "customer_receipt", amount: "250000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-10-02", type: "sale", prod: "PLATE 2HN DIP", qty: "1930", rate: "70", amount: "135100", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-10-03", type: "customer_receipt", amount: "178000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-10-12", type: "sale", prod: "PLATE 2HN DIP", qty: "1948", rate: "70", amount: "136360", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-10-19", type: "customer_receipt", amount: "136400", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-11-03", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "500", rate: "130", amount: "65000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2023-11-03", type: "sale", prod: "PLATE 2HN DIP", qty: "600", rate: "65", amount: "39000", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-11-13", type: "customer_receipt", amount: "200000", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-11-18", type: "sale", prod: "PLATE KHYBER 17KG", qty: "555", rate: "113", amount: "62715", desc: "PLATE KHYER 17KG", method: "cash" },
    { date: "2023-11-18", type: "sale", prod: "PLATE 2HN DIP", qty: "1164", rate: "65", amount: "75660", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-12-05", type: "sale", prod: "PLATE 2HN DIP", qty: "2000", rate: "65", amount: "130000", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-12-06", type: "customer_receipt", amount: "172300", desc: "RECEIVED ONLINE MBL", method: "bank" },
    { date: "2023-12-18", type: "sale", prod: "PLATE 2HN DIP", qty: "1420", rate: "73", amount: "103660", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2023-12-18", type: "sale", prod: "PLATE KHYBER 15KG", qty: "1543", rate: "112", amount: "172816", desc: "PLATE KHYBER 15KG", method: "cash" },
    { date: "2023-12-18", type: "sale", prod: "PLATE KHYBER 12.5KG", qty: "54", rate: "93", amount: "5022", desc: "PLATE KHYBER 12.5KG", method: "cash" },
    { date: "2023-12-19", type: "customer_receipt", amount: "200000", desc: "RECEIVED ONLINE MBL", method: "bank" },

    // 2024
    { date: "2024-01-08", type: "customer_receipt", amount: "400000", desc: "RECEIVED ONLINE MBL CROWN", method: "bank" },
    { date: "2024-01-13", type: "sale", prod: "PLATE KHYBER 170gm DIP", qty: "900", rate: "132", amount: "118800", desc: "PLATE KHYBER 170gm DIP", method: "cash" },
    { date: "2024-01-13", type: "sale", prod: "PLATE 2HN DIP", qty: "3150", rate: "76", amount: "239400", desc: "PLATE 2HN DIP", method: "cash" },
    { date: "2024-01-16", type: "customer_receipt", amount: "200000", desc: "RECEIVED ONLINE MBL SHAHID", method: "bank" },
    { date: "2024-01-26", type: "sale", prod: "PLATE KHYBER 170gm DIP", qty: "2940", rate: "132", amount: "388080", desc: "PLATE KHYBER 170gm DIP", method: "cash" },
    { date: "2024-01-30", type: "customer_receipt", amount: "227853", desc: "RECEIVD ONLINE MBL CROWN", method: "bank" },
    { date: "2024-03-07", type: "sale", prod: "PLATE KHYBER 170gm DIP", qty: "1020", rate: "128", amount: "130560", desc: "PLATE KHABER 170g DIP", method: "cash" },
    { date: "2024-03-07", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1000", rate: "140", amount: "140000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2024-03-07", type: "sale", prod: "PLATE 2HN P+VE SP (DIP)", qty: "952", rate: "91", amount: "86632", desc: "PLATE 2HN STANDARD DIP", method: "cash" },
    { date: "2024-03-12", type: "customer_receipt", amount: "350000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-04-02", type: "sale", prod: "PLATE 2HN (120g) DIP", qty: "1929", rate: "90", amount: "173610", desc: "PLATE 2HN (120g) DIP", method: "cash" },
    { date: "2024-04-02", type: "sale", prod: "PLATE KHYBER 170gm DIP", qty: "1002", rate: "126", amount: "126252", desc: "PLATE KHABER 170g DIP", method: "cash" },
    { date: "2024-04-02", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1000", rate: "140", amount: "140000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2024-04-04", type: "customer_receipt", amount: "447000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-04-24", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1000", rate: "140", amount: "140000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2024-04-24", type: "sale", prod: "PLATE 2HN (120g) DIP", qty: "1980", rate: "86", amount: "170280", desc: "PLATE 2HN (120g) DIP", method: "cash" },
    { date: "2024-04-24", type: "customer_receipt", amount: "2500", desc: "PAITI OLD CARRIAGE ADJUST", method: "cash" },
    { date: "2024-05-03", type: "customer_receipt", amount: "300000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-05-10", type: "sale", prod: "PLATE 2HN (120g) DIP", qty: "2033", rate: "81", amount: "164673", desc: "PLATE 2HN (120g) DIP", method: "cash" },
    { date: "2024-05-10", type: "sale", prod: "PLATE SUPER SHALIMAR", qty: "1000", rate: "135", amount: "135000", desc: "PLATE SUPER SHALIMAR", method: "cash" },
    { date: "2024-05-24", type: "customer_receipt", amount: "307500", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-06-24", type: "sale", prod: "PLATE 2HN (120g) DIP", qty: "1980", rate: "77", amount: "152460", desc: "PLATE 2HN(120g)DIP", method: "cash" },
    { date: "2024-06-24", type: "sale", prod: "PLATE KHYBER(210g)CHARG", qty: "1000", rate: "140", amount: "140000", desc: "PLATE KHYBER(210g)CHARG", method: "cash" },
    { date: "2024-06-27", type: "customer_receipt", amount: "100000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-07-02", type: "customer_receipt", amount: "100000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
    { date: "2024-07-16", type: "customer_receipt", amount: "92000", desc: "RECEIVED ONLINE MBL CR", method: "bank" },
  ];

  console.log(`📝 Inserting ${items.length} ledger transactions for NEW SUPER SINDH BATTERY SERVICE...`);

  await db.transaction(async (tx) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as { type: string; amount: string; date: string; desc: string; method: string; qty?: string; rate?: string; prod?: string };
      const seqKey = item.type === "sale" ? "tx-sales" : "tx-receipt";
      const prefix = item.type === "sale" ? "SL" : "RC";
      const txNumber = await nextDocumentNumber(tx, seqKey, prefix, new Date(item.date));

      const prodId = item.prod ? productMap.get(item.prod) || null : null;

      await tx.insert(transactions).values({
        transactionNumber: txNumber,
        partyId: party.id,
        productId: prodId,
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

  console.log("✅ Successfully seeded NEW SUPER SINDH BATTERY SERVICE party, products, and all historical transactions into database!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
