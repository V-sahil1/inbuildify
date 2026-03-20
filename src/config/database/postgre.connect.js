import db, { initModels } from "./models/postgre-models/index.js";

export const connectPostgre = async () => {
  try {

    await initModels();

    await db.sequelize.authenticate();
    // await db.sequelize.sync({ force: true });
    // await db.sequelize.sync({ alter: true });
    console.log(" Database synced successfully");

  } catch (error) {
    console.error(" Database connection error:", error);
  }
};

export default db;