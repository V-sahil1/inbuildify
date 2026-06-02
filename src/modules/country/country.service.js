import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";

class CountryService {
  /**
   * Fetch all countries where name is 'australia'
   * @returns {Promise<Array>}
   */
  async getCountries() {
    const { Country } = db.sequelize.models;
    const countries = await Country.findAll({
      where: { name: "australia" },
    });

    return keysToCamelCase(countries.map(c => c.get({ plain: true })));
  }
}

export default new CountryService();
