// // import getPool from "../../config/database.js";
// // import { errorResponse, successResponse } from "../../helper/response.js";
// // import { keysToCamelCase } from "../../utils/common.js";

// // export async function getAllDwellingTypes(req, res) {
// //   const pool = getPool();
// //   const client = await pool.connect();

// //   try {
// //     const builderId = req.user.builder_id;

// //     const dataQuery = `
// //       SELECT 
// //         *
// //       FROM dwelling_type 
// //       WHERE builder_id = $1
// //       ORDER BY created_at DESC;
// //     `;

// //     const dataResult = await client.query(dataQuery, [builderId]);

// //     return successResponse(
// //       res,
// //       keysToCamelCase(dataResult.rows),
// //       "dwelling type fetched successfully.",
// //     );
// //   } catch (error) {
// //     console.error("Error fetching dwelling type:", error);
// //     return errorResponse(res, 500, error.message || "Internal Server Error");
// //   } finally {
// //     client.release();
// //   }
// // }

// // export async function createDwellingType(req, res) {
// //   const pool = getPool();
// //   const client = await pool.connect();

// //   try {
// //     const builderId = req.user?.builder_id;
// //     const companyId = req.user?.company_id;
// //     const userId = req.user?.user_id;

// //     const { name, is_active } = req.body;

// //     if (!builderId && !companyId) {
// //       return errorResponse(
// //         res,
// //         401,
// //         "Unauthorized: Missing builder or company ID.",
// //       );
// //     }

// //     if (!name) {
// //       return errorResponse(res, 400, "Dwelling type name is required.");
// //     }

// //     await client.query("BEGIN");

// //     const duplicateCheck = await client.query(
// //       `
// //       SELECT 1 
// //       FROM dwelling_type 
// //       WHERE LOWER(name) = LOWER($1)
// //         AND (builder_id = $2 OR company_id = $3)
// //       `,
// //       [name.trim(), builderId, companyId],
// //     );

// //     if (duplicateCheck.rowCount > 0) {
// //       await client.query("ROLLBACK");
// //       return errorResponse(
// //         res,
// //         400,
// //         "Dwelling type with this name already exists.",
// //       );
// //     }

// //     const insertQuery = `
// //       INSERT INTO dwelling_type (
// //         company_id,
// //         builder_id,
// //         name,
// //         is_active,
// //         created_by,
// //         updated_by
// //       )
// //       VALUES ($1, $2, $3, $4, $5, $6)
// //       RETURNING dwelling_type_id, company_id, builder_id, name, is_active, created_by, updated_by, created_at, updated_at;
// //     `;

// //     const values = [
// //       companyId,
// //       builderId,
// //       name.trim(),
// //       is_active ?? true,
// //       userId,
// //       userId,
// //     ];

// //     const result = await client.query(insertQuery, values);
// //     await client.query("COMMIT");

// //     return successResponse(
// //       res,
// //       keysToCamelCase(result.rows[0]),
// //       "Dwelling type created successfully.",
// //     );
// //   } catch (err) {
// //     await client.query("ROLLBACK");
// //     console.error("Error creating dwelling type:", err);
// //     return errorResponse(res, 500, err.message || "Internal Server Error");
// //   } finally {
// //     client.release();
// //   }
// // }

// // export async function updateDwellingType(req, res) {
// //   const pool = getPool();
// //   const client = await pool.connect();

// //   const { dwelling_type_id } = req.params;
// //   const { name } = req.body;
// //   const builderId = req.user.builder_id;
// //   const userId = req.user?.user_id;

// //   try {
// //     await client.query("BEGIN");

// //     const existingDwellingType = await client.query(
// //       "SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2",
// //       [dwelling_type_id, builderId],
// //     );

// //     if (existingDwellingType.rowCount === 0) {
// //       await client.query("ROLLBACK");
// //       return errorResponse(res, 404, "Dwelling type not found.");
// //     }

// //     const existingActiveDwellingType = await client.query(
// //       "SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_active = true",
// //       [dwelling_type_id, builderId],
// //     );

// //     if (existingActiveDwellingType.rowCount === 0) {
// //       await client.query("ROLLBACK");
// //       return errorResponse(res, 404, "Inactive dwelling type.");
// //     }

// //     if (!name) {
// //       await client.query("ROLLBACK");
// //       return errorResponse(
// //         res,
// //         400,
// //         "At least one field is required to update.",
// //       );
// //     }

// //     if (name) {
// //       const duplicateName = await client.query(
// //         `SELECT 1 
// //           FROM dwelling_type 
// //           WHERE LOWER(name) = LOWER($1) 
// //           AND builder_id = $2 
// //           AND dwelling_type_id != $3`,
// //         [name.trim(), builderId, dwelling_type_id],
// //       );

// //       if (duplicateName.rowCount > 0) {
// //         await client.query("ROLLBACK");
// //         return errorResponse(
// //           res,
// //           400,
// //           "Dwelling type with this name already exists.",
// //         );
// //       }
// //     }

// //     let i = 1;
// //     const fields = [];
// //     const values = [];

// //     if (name) {
// //       fields.push(`name = $${i++}`);
// //       values.push(name.trim());
// //     }

// //     fields.push(`updated_by = $${i++}`);
// //     values.push(userId);
// //     fields.push("updated_at = NOW()");

// //     const updateQuery = `
// //         UPDATE dwelling_type
// //         SET ${fields.join(", ")}
// //         WHERE dwelling_type_id = $${i++} AND builder_id = $${i}
// //         RETURNING *;
// //     `;

// //     values.push(dwelling_type_id, builderId);

// //     const result = await client.query(updateQuery, values);

// //     await client.query("COMMIT");

// //     return successResponse(
// //       res,
// //       keysToCamelCase(result.rows[0]),
// //       "Dwelling type updated successfully.",
// //     );
// //   } catch (error) {
// //     await client.query("ROLLBACK");
// //     console.error("Error updating dwelling type:", error);
// //     return errorResponse(res, 500, error?.message || "Internal Server Error");
// //   } finally {
// //     client.release();
// //   }
// // }

// // export async function deleteDwellingType(req, res) {
// //   const pool = getPool();
// //   const client = await pool.connect();

// //   const { dwelling_type_id } = req.params;
// //   const builderId = req.user.builder_id;
// //   try {
// //     const checkDwellingTypeExists = await client.query(
// //       "SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2",
// //       [dwelling_type_id, builderId],
// //     );
// //     if (checkDwellingTypeExists.rowCount === 0) {
// //       return errorResponse(
// //         res,
// //         404,
// //         "Dwelling type not found for this builder",
// //       );
// //     }

// //     await client.query("BEGIN");

// //     // Remove dwelling_type_id from all price_list_item records that reference it
// //     const updatePriceListItemsQuery = `
// //       UPDATE price_list_item 
// //       SET dwelling_type_id = array_remove(dwelling_type_id, $1)
// //       WHERE $1 = ANY(dwelling_type_id)
// //     `;

// //     await client.query(updatePriceListItemsQuery, [dwelling_type_id]);

// //     // Remove dwelling_type_id from all package records that reference it
// //     const updatePackagesQuery = `
// //       UPDATE package 
// //       SET dwelling_type_id = array_remove(dwelling_type_id, $1)
// //       WHERE $1 = ANY(dwelling_type_id)
// //     `;

// //     await client.query(updatePackagesQuery, [dwelling_type_id]);

// //     // Delete the dwelling type
// //     const query = "delete FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2;";
// //     const result = await client.query(query, [dwelling_type_id, builderId]);

// //     await client.query("COMMIT");

// //     return successResponse(
// //       res,
// //       keysToCamelCase(result.rows[0]),
// //       "Dwelling type deleted successfully.",
// //     );
// //   } catch (error) {
// //     await client.query("ROLLBACK");
// //     console.error(error);
// //     return errorResponse(res, 500, error?.message || "Internal Server Error");
// //   } finally {
// //     client.release();
// //   }
// // }

// // export async function updateDwellingTypeActive(req, res) {
// //   const pool = getPool();
// //   const client = await pool.connect();

// //   try {
// //     const builderId = req.user?.builder_id;
// //     const userId = req.user?.user_id;
// //     const { dwelling_type_id } = req.params;
// //     const { is_active } = req.body;

// //     if (!dwelling_type_id) {
// //       return errorResponse(res, 400, "dwelling type id is required");
// //     }

// //     if (typeof is_active !== "boolean") {
// //       return errorResponse(
// //         res,
// //         400,
// //         "is_active must be boolean (true or false)",
// //       );
// //     }

// //     const existing = await client.query(
// //       `
// //       SELECT dwelling_type_id
// //       FROM dwelling_type
// //       WHERE dwelling_type_id = $1
// //         AND builder_id = $2
// //       `,
// //       [dwelling_type_id, builderId],
// //     );

// //     if (existing.rowCount === 0) {
// //       return errorResponse(
// //         res,
// //         404,
// //         "dwelling type not found for this builder",
// //       );
// //     }

// //     const updateQuery = `
// //       UPDATE dwelling_type
// //       SET
// //         is_active = $1,
// //         updated_by = $2,
// //         updated_at = NOW()
// //       WHERE dwelling_type_id = $3
// //       RETURNING *;
// //     `;

// //     const updated = await client.query(updateQuery, [
// //       is_active,
// //       userId,
// //       dwelling_type_id,
// //     ]);

// //     return successResponse(
// //       res,
// //       keysToCamelCase(updated.rows[0]),
// //       "Dwelling type status updated successfully.",
// //     );
// //   } catch (error) {
// //     console.error("Error updating dwelling type is_active:", error);
// //     return errorResponse(res, 500, error?.message || "Internal Server Error");
// //   } finally {
// //     client.release();
// //   }
// // }

// import { Op, literal } from "sequelize";
// import { errorResponse, successResponse } from "../../helper/response.js";
// import { keysToCamelCase } from "../../utils/common.js";
// import db from "../../config/database/models/postgre-models/index.js";
// // ─────────────────────────────────────────────
// // GET ALL DWELLING TYPES
// // ─────────────────────────────────────────────
// export async function getAllDwellingTypes(req, res) {
//   try {
//     const { DwellingType } = db;
//     const builderId = req.user.builder_id;

//     const dwellingTypes = await DwellingType.findAll({
//       where: { builder_id: builderId },
//       order: [["createdAt", "DESC"]],
//     });

//     return successResponse(
//       res,
//       keysToCamelCase(dwellingTypes.map((d) => d.toJSON())),
//       "dwelling type fetched successfully.",
//     );
//   } catch (error) {
//     console.error("Error fetching dwelling type:", error);
//     return errorResponse(res, 500, error.message || "Internal Server Error");
//   }
// }

// // ─────────────────────────────────────────────
// // CREATE DWELLING TYPE
// // ─────────────────────────────────────────────
// export async function createDwellingType(req, res) {
//   const { sequelize, DwellingType } = db;
//   const t = await sequelize.transaction();

//   try {
//     const builderId = req.user?.builder_id;
//     const companyId = req.user?.company_id;
//     const userId = req.user?.user_id;

//     const { name, is_active } = req.body;

//     if (!builderId && !companyId) {
//       await t.rollback();
//       return errorResponse(res, 401, "Unauthorized: Missing builder or company ID.");
//     }

//     if (!name) {
//       await t.rollback();
//       return errorResponse(res, 400, "Dwelling type name is required.");
//     }

//     // ── Duplicate name check ───────────────────────────────────
//     const dupCheck = await DwellingType.findOne({
//       where: {
//         [Op.and]: [
//           literal(`LOWER(name) = LOWER('${name.trim().replace(/'/g, "''")}')`),
//           {
//             [Op.or]: [
//               { builder_id: builderId },
//               { company_id: companyId },
//             ],
//           },
//         ],
//       },
//       transaction: t,
//     });

//     if (dupCheck) {
//       await t.rollback();
//       return errorResponse(res, 400, "Dwelling type with this name already exists.");
//     }

//     // ── Insert new dwelling type ───────────────────────────────
//     const newDwellingType = await DwellingType.create(
//       {
//         company_id: companyId,
//         builder_id: builderId,
//         name: name.trim(),
//         is_active: is_active ?? true,
//         created_by: userId,
//         updated_by: userId,
//       },
//       { transaction: t },
//     );

//     await t.commit();

//     return successResponse(
//       res,
//       keysToCamelCase(newDwellingType.toJSON()),
//       "Dwelling type created successfully.",
//     );
//   } catch (err) {
//     await t.rollback();
//     console.error("Error creating dwelling type:", err);
//     return errorResponse(res, 500, err.message || "Internal Server Error");
//   }
// }

// // ─────────────────────────────────────────────
// // UPDATE DWELLING TYPE
// // ─────────────────────────────────────────────
// export async function updateDwellingType(req, res) {
//   const { sequelize, DwellingType } = db;
//   const t = await sequelize.transaction();

//   try {
//     const { dwelling_type_id } = req.params;
//     const { name } = req.body;
//     const builderId = req.user.builder_id;
//     const userId = req.user?.user_id;

//     // ── Fetch existing dwelling type ───────────────────────────
//     const existingDwellingType = await DwellingType.findOne({
//       where: { dwelling_type_id, builder_id: builderId },
//       transaction: t,
//     });

//     if (!existingDwellingType) {
//       await t.rollback();
//       return errorResponse(res, 404, "Dwelling type not found.");
//     }

//     if (!existingDwellingType.is_active) {
//       await t.rollback();
//       return errorResponse(res, 404, "Inactive dwelling type.");
//     }

//     if (!name) {
//       await t.rollback();
//       return errorResponse(res, 400, "At least one field is required to update.");
//     }

//     // ── Duplicate name check ───────────────────────────────────
//     const dupName = await DwellingType.findOne({
//       where: {
//         builder_id: builderId,
//         dwelling_type_id: { [Op.ne]: dwelling_type_id },
//         [Op.and]: literal(
//           `LOWER(name) = LOWER('${name.trim().replace(/'/g, "''")}')`,
//         ),
//       },
//       transaction: t,
//     });

//     if (dupName) {
//       await t.rollback();
//       return errorResponse(res, 400, "Dwelling type with this name already exists.");
//     }

//     // ── Update ─────────────────────────────────────────────────
//     await existingDwellingType.update(
//       {
//         name: name.trim(),
//         updated_by: userId,
//         updatedAt: new Date(),
//       },
//       { transaction: t },
//     );

//     await t.commit();

//     return successResponse(
//       res,
//       keysToCamelCase(existingDwellingType.toJSON()),
//       "Dwelling type updated successfully.",
//     );
//   } catch (error) {
//     await t.rollback();
//     console.error("Error updating dwelling type:", error);
//     return errorResponse(res, 500, error?.message || "Internal Server Error");
//   }
// }

// // ─────────────────────────────────────────────
// // DELETE DWELLING TYPE
// // ─────────────────────────────────────────────
// export async function deleteDwellingType(req, res) {
//   const { sequelize, DwellingType, PriceListItem, Package } = db;
//   const t = await sequelize.transaction();

//   try {
//     const { dwelling_type_id } = req.params;
//     const builderId = req.user.builder_id;

//     const existingDwellingType = await DwellingType.findOne({
//       where: { dwelling_type_id, builder_id: builderId },
//       transaction: t,
//     });

//     if (!existingDwellingType) {
//       await t.rollback();
//       return errorResponse(res, 404, "Dwelling type not found for this builder");
//     }

//     // ── Remove dwelling_type_id from price_list_item arrays ────
//     await PriceListItem.update(
//       {
//         dwelling_type_id: literal(
//           `array_remove(dwelling_type_id, '${dwelling_type_id}'::uuid)`,
//         ),
//       },
//       {
//         where: literal(`'${dwelling_type_id}'::uuid = ANY(dwelling_type_id)`),
//         transaction: t,
//       },
//     );

//     // ── Remove dwelling_type_id from package arrays ───────────
//     await Package.update(
//       {
//         dwelling_type_id: literal(
//           `array_remove(dwelling_type_id, '${dwelling_type_id}'::uuid)`,
//         ),
//       },
//       {
//         where: literal(`'${dwelling_type_id}'::uuid = ANY(dwelling_type_id)`),
//         transaction: t,
//       },
//     );

//     // ── Delete the dwelling type ───────────────────────────────
//     await existingDwellingType.destroy({ transaction: t });

//     await t.commit();

//     return successResponse(
//       res,
//       keysToCamelCase(existingDwellingType.toJSON()),
//       "Dwelling type deleted successfully.",
//     );
//   } catch (error) {
//     await t.rollback();
//     console.error(error);
//     return errorResponse(res, 500, error?.message || "Internal Server Error");
//   }
// }

// // ─────────────────────────────────────────────
// // UPDATE DWELLING TYPE ACTIVE STATUS
// // ─────────────────────────────────────────────
// export async function updateDwellingTypeActive(req, res) {
//   try {
//     const { DwellingType } = db;
//     const builderId = req.user?.builder_id;
//     const userId = req.user?.user_id;
//     const { dwelling_type_id } = req.params;
//     const { is_active } = req.body;

//     if (!dwelling_type_id) {
//       return errorResponse(res, 400, "dwelling type id is required");
//     }

//     if (typeof is_active !== "boolean") {
//       return errorResponse(res, 400, "is_active must be boolean (true or false)");
//     }

//     const existingDwellingType = await DwellingType.findOne({
//       where: { dwelling_type_id, builder_id: builderId },
//     });

//     if (!existingDwellingType) {
//       return errorResponse(res, 404, "dwelling type not found for this builder");
//     }

//     await existingDwellingType.update({
//       is_active,
//       updated_by: userId,
//       updatedAt: new Date(),
//     });

//     return successResponse(
//       res,
//       keysToCamelCase(existingDwellingType.toJSON()),
//       "Dwelling type status updated successfully.",
//     );
//   } catch (error) {
//     console.error("Error updating dwelling type is_active:", error);
//     return errorResponse(res, 500, error?.message || "Internal Server Error");
//   }
// }

import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { createDwellingTypeService, deleteDwellingTypeService, getAllDwellingTypesService, updateDwellingTypeActiveService, updateDwellingTypeService } from "./dwellingType.service.js";

// GET
export async function getAllDwellingTypes(req, res) {
  try {
    const data = await getAllDwellingTypesService(req.user.builder_id);

    return successResponse(
      res,
      keysToCamelCase(data.map(d => d.toJSON())),
      "dwelling type fetched successfully"
    );
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
}

// CREATE
export async function createDwellingType(req, res) {
  try {
    const data = await createDwellingTypeService(req.body, req.user);

    return successResponse(
      res,
      keysToCamelCase(data.toJSON()),
      "Dwelling type created successfully"
    );
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
}

// UPDATE
export async function updateDwellingType(req, res) {
  try {
    const data = await updateDwellingTypeService(
      req.params.dwelling_type_id,
      req.body,
      req.user
    );

    return successResponse(
      res,
      keysToCamelCase(data.toJSON()),
      "Dwelling type updated successfully"
    );
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
}

// DELETE
export async function deleteDwellingType(req, res) {
  try {
    const data = await deleteDwellingTypeService(
      req.params.dwelling_type_id,
      req.user.builder_id
    );

    return successResponse(
      res,
      keysToCamelCase(data.toJSON()),
      "Dwelling type deleted successfully"
    );
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
}

// UPDATE ACTIVE
export async function updateDwellingTypeActive(req, res) {
  try {
    const data = await updateDwellingTypeActiveService(
      req.params.dwelling_type_id,
      req.body.is_active,
      req.user
    );

    return successResponse(
      res,
      keysToCamelCase(data.toJSON()),
      "Dwelling type status updated successfully"
    );
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
}