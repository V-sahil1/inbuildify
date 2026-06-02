import db from "../../config/database/models/postgre-models/index.js";

/**
 * Fetches all states belonging to Australia.
 */
export const getAllStatesService = async () => {
  const { State, Country } = db;

  const states = await State.findAll({
    include: [
      {
        model: Country,
        as: "country",
        where: { name: "australia" },
        attributes: ["name"],
      },
    ],
    order: [["name", "ASC"]],
  });

  return states.map((state) => {
    const item = state.toJSON();
    return {
      stateId: item.state_id,
      name: item.name,
      countryId: item.country_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      countryName: item.country?.name,
    };
  });
};

/**
 * Fetches states by country ID.
 */
export const getStatesByCountryIdService = async (countryId) => {
  const { State, Country } = db;

  // Verify country exists and is 'australia' as per legacy logic
  const country = await Country.findOne({
    where: {
      country_id: countryId,
      name: "australia",
    },
  });

  if (!country) {
    return { error: "Country not found.", status: 404 };
  }

  const states = await State.findAll({
    where: { country_id: countryId },
  });

  if (states.length === 0) {
    return { error: "State not found with this country.", status: 404 };
  }

  return states.map((state) => {
    const item = state.get({ plain: true });
    return {
      stateId: item.state_id,
      name: item.name,
      countryId: item.country_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });
};

export default {
  getAllStatesService,
  getStatesByCountryIdService,
};
