const getPool = require("../config/database");

const seedCategories = async () => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    console.log("🌱 Starting categories seeding...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_category (
        admin_category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    const adminCategories = [
      {
        name: "base price",
        description: "base pricing for standard home package",
      },
      {
        name: "site costs",
        description: "site preparation and foundation-related costs",
      },
      {
        name: "kitchen",
        description: "kitchen fixtures, fittings, and customization",
      },
      {
        name: "electrical",
        description: "wiring, lighting, and additional electrical requirements",
      },
      {
        name: "pre construction",
        description: "pre-construction fees and mandatory works",
      },
      {
        name: "retaining wall",
        description: "costs related to retaining walls",
      },
      {
        name: "council requirements",
        description: "council-related fees and compliance requirements",
      },
      {
        name: "external structure",
        description: "costs for external structure and add-ons",
      },
    ];

    for (const adminCategory of adminCategories) {
      await client.query(
        `
        INSERT INTO admin_category (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO NOTHING;
        `,
        [adminCategory.name, adminCategory.description]
      );
    }

    console.log("✅ Categories seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    client.release();
    process.exit(0);
  }
};

seedCategories();
