const getPool = require("../config/database");

const seedCountriesAndStates = async () => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    console.log("🌱 Starting country/state seeding...");

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS country (
        country_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS state (
        state_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        country_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT fk_country FOREIGN KEY (country_id) REFERENCES country(country_id) ON DELETE CASCADE,
        CONSTRAINT unique_state_per_country UNIQUE (country_id, name)
      );
    `);

    const data = {
      australia: {
        states: [
          "new south wales",
          "queensland",
          "victoria",
          "tasmania",
          "south australia",
          "western australia",
          "australian capital territory",
          "northern territory",
        ],
      },
      singapore: {
        states: [
          "central singapore",
          "north singapore",
          "north-east singapore",
          "east singapore",
          "west singapore",
        ],
      },
    };

    for (const [countryName, details] of Object.entries(data)) {
      const countryResult = await client.query(
        `
        INSERT INTO country (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING country_id;
        `,
        [countryName]
      );

      const countryId = countryResult.rows[0].country_id;

      for (const stateName of details.states) {
        await client.query(
          `
          INSERT INTO state (name, country_id)
          VALUES ($1, $2)
          ON CONFLICT (country_id, name) DO UPDATE SET updated_at = NOW();
          `,
          [stateName, countryId]
        );
      }
    }

    console.log("✅ Countries and states seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    client.release();
    process.exit(0);
  }
};

seedCountriesAndStates();
