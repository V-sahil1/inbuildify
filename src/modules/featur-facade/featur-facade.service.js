import db from "../../config/database/models/postgre-models/index.js";
import { Op } from "sequelize";

export async function getFeatureFacadeService({ page, limit }) {
    try {
        const now = new Date();

        // Automatically set is_active to false if end_date has passed
        await db.FeaturFacade.update(
            { is_active: false },
            {
                where: {
                    is_active: true,
                    end_date: { [Op.lt]: now },
                },
            }
        );

        const result = await db.FeaturFacade.findAll({
            where: {
                is_active: true,
                is_delete: false,
                [Op.or]: [{ end_date: { [Op.gte]: now } }, { end_date: null }],
            },
            limit: limit,
            offset: (page - 1) * limit,
            include: [
                {
                    model: db.Facade,
                    as: "facade",
                    required: true,
                    include: [
                        {
                            model: db.Builder,
                            as: "builder",
                            attributes: ["name"],
                        },
                        {
                            model: db.FloorPlanFacadeMap,
                            as: "floorPlanMaps",
                            include: [
                                {
                                    model: db.FloorPlan,
                                    as: "floorPlan",
                                    attributes: ["total_area", "beds", "baths", "carpark"],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        return result.map((item) => {
            const facade = item.facade?.get({ plain: true });
            if (facade) {
                const floorPlan = facade.floorPlanMaps?.[0]?.floorPlan || null;
                delete facade.floorPlanMaps;
                return { featur_facade_id: item.featur_facade_id, ...facade, floorPlan, };
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        return error;
    }
}

export async function createFeatureFacadeService({
    builder_id,
    company_id,
    start_date,
    end_date,
    is_active,
    facade_id,
}) {
    try {
        const existingFacade = await db.FeaturFacade.findOne({
            where: {
                builder_id,
                company_id,
                start_date,
                end_date,
                is_active,
                facade_id,
                is_delete: false
            }
        })

        if (existingFacade) {
            throw new Error("Feature Facade already exists.");
        }
        const result = await db.FeaturFacade.create({
            builder_id,
            company_id,
            start_date,
            end_date,
            is_active,
            facade_id,
        });
        return result;
    } catch (error) {
        return error;
    }
}

export async function getFeatureFacadeByIdService({ id, builderId, companyId }) {
    try {
        const where = {
            featur_facade_id: id,
            builder_id: builderId,
            company_id: companyId,
            is_delete: false
        };

        const result = await db.FeaturFacade.findOne({
            where,
            include: [
                {
                    model: db.Facade,
                    as: "facade",
                    include: [
                        {
                            model: db.Builder,
                            as: "builder",
                            attributes: ["name"],
                        },
                        {
                            model: db.FloorPlanFacadeMap,
                            as: "floorPlanMaps",
                            include: [
                                {
                                    model: db.FloorPlan,
                                    as: "floorPlan",
                                    attributes: ["total_area", "beds", "baths", "carpark"],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!result) {
            throw new Error("Feature Facade not found");
        }
        const facade = result.facade?.get({ plain: true });
        if (facade) {
            const floorPlan = facade.floorPlanMaps?.[0]?.floorPlan || null;
            delete facade.floorPlanMaps;
            return { ...facade, floorPlan, featur_facade_id: result.featur_facade_id };
        }
        return null;
    } catch (error) {
        throw error;
    }
}

export async function updateFeatureFacadeService({
    id,
    builderId,
    companyId,
    payload,
}) {
    try {
        const where = {
            featur_facade_id: id,
            builder_id: builderId,
            company_id: companyId,
            is_delete: false
        };

        const [updatedCount] = await db.FeaturFacade.update(payload, {
            where
        });

        if (updatedCount === 0) {
            throw new Error("Feature Facade not found");
        }

        return await db.FeaturFacade.findOne({
            where
        });
    } catch (error) {
        return error;
    }
}

export async function deleteFeatureFacadeService({ id, builderId, companyId }) {
    try {
        const where = {
            featur_facade_id: id,
            builder_id: builderId,
            company_id: companyId,
        };

        const [updatedCount] = await db.FeaturFacade.update(
            { is_delete: true },
            { where }
        );

        if (updatedCount === 0) {
            throw new Error("Feature Facade not found");
        }

        return updatedCount;
    } catch (error) {
        throw error;
    }
}
