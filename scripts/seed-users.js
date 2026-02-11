const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

function loadEnvFile(filename) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key || process.env[key]) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "Asb@12345";
const USER_IDS = ["ops1", "ops2", "ops3", "ops4", "ops5"];

const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db();
  const users = db.collection("users");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let skipped = 0;

  for (const userId of USER_IDS) {
    const normalized = String(userId).trim().toLowerCase();
    const existing = await users.findOne({ email: normalized });

    if (existing) {
      skipped += 1;
      continue;
    }

    await users.insertOne({
      email: normalized,
      name: normalized.toUpperCase(),
      passwordHash,
      createdAt: new Date(),
    });
    created += 1;
  }

  console.log(`Seed complete. Created: ${created}, skipped: ${skipped}.`);
}

run()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.close();
  });
