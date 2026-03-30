import getPool from "../config/database.js";

const seedServices = async () => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    console.log("🌱 Starting services seeding...");

    // Ensure the table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS service (
        service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service VARCHAR(100) NOT NULL,
        builder_id UUID DEFAULT NULL,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE SET NULL
      );
    `);

    // Static seed data
    const services = [
      { service: "Color Painting" },
      { service: "Furniture Installation" },
      { service: "Plumbing Service" },
      { service: "Electrical Work" },
      { service: "Interior Design" },
    ];

    // Insert data (ignore duplicates)
    for (const s of services) {
      await client.query(
        `
        INSERT INTO service (service)
        VALUES ($1)
        ON CONFLICT (service_id) DO NOTHING;
        `,
        [s.service],
      );
    }

    console.log("✅ Services seeding completed.");
  } catch (error) {
    console.error("❌ Service seeding failed:", error);
  } finally {
    client.release();
    process.exit(0);
  }
};

seedServices();
