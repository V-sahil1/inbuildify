const getPool = require("../config/database");

const seedConditions = async () => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    console.log("🌱 Starting conditions seeding...");

    // Create conditions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS conditions (
        condition_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Static conditions to seed
    const conditions = [
      {
        name: "SQFT_LIMIT",
        description: "Restriction based on total square footage range",
      },
      {
        name: "WIDTH_LIMIT",
        description: "Restriction based on building width",
      },
      {
        name: "HEIGHT_LIMIT",
        description: "Restriction based on building height",
      },
      {
        name: "FLOOR_LIMIT",
        description: "Restriction based on number of floors",
      },
      {
        name: "CUSTOM_RULE",
        description: "Custom rule defined by the builder",
      },
    ];

    // Insert each condition if not already present
    for (const condition of conditions) {
      await client.query(
        `
        INSERT INTO conditions (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO NOTHING;
        `,
        [condition.name, condition.description]
      );
    }

    console.log("✅ Conditions seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    client.release();
    process.exit(0);
  }
};

seedConditions();
