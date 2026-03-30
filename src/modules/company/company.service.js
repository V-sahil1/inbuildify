// import getPool from "../../config/database.js";
import { createOrUpdateAddress } from "../../repositories/address.repository.js";
import { keysToCamelCase } from "../../utils/common.js";
import db from "../../config/database/models/postgre-models/index.js";

// export async function getCompanyByBuilderId(builderId, client) {
//   const result = await client.query(
//     `SELECT c.*, a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code
//      FROM company c
//      LEFT JOIN address a ON c.address_id = a.address_id
//      WHERE c.builder_id = $1 LIMIT 1`,
//     [builderId],
//   );

//   const company = result.rows[0] || null;

//   if (!company) {
//     return null;
//   }

//   if (company.timezone_id) {
//     const tzResult = await client.query(
//       "SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1",
//       [company.timezone_id],
//     );

//     company.timezone =
//       tzResult.rowCount > 0
//         ? [tzResult.rows[0].timezone_id, tzResult.rows[0].timezone_name]
//         : null;
//   } else {
//     company.timezone = null;
//   }

//   // Create address object if address exists
//   if (company.address_id) {
//     company.address = {
//       address_line1: company.address_line1,
//       address_line2: company.address_line2,
//       city: company.city,
//       state_id: company.state_id,
//       country_id: company.country_id,
//       zip_code: company.zip_code,
//     };

//     // Remove individual address fields
//     delete company.address_line1;
//     delete company.address_line2;
//     delete company.city;
//     delete company.state_id;
//     delete company.country_id;
//     delete company.zip_code;
//   }

//   return keysToCamelCase(company);
// }

// export async function upsertCompany(builderId, payload, client) {
//   const existingCompany = await getCompanyByBuilderId(builderId, client);

//   // Handle address object
//   let addressId = null;
//   if (payload.address) {
//     addressId = await addressRepo.createOrUpdateAddress(
//       existingCompany?.addressId || null,
//       payload.address,
//     );
//   } else if (existingCompany?.addressId) {
//     // Keep existing address if no new address provided
//     addressId = existingCompany.addressId;
//   }

//   const mapTimezone = async (company) => {
//     if (!company) {
//       return null;
//     }

//     if (company.timezone_id) {
//       const tzResult = await client.query(
//         "SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1",
//         [company.timezone_id],
//       );

//       company.timezone =
//         tzResult.rowCount > 0
//           ? [tzResult.rows[0].timezone_id, tzResult.rows[0].timezone_name]
//           : null;
//     } else {
//       company.timezone = null;
//     }

//     return keysToCamelCase(company);
//   };

//   if (!existingCompany) {
//     const insertQuery = `
//       INSERT INTO company (
//         builder_id,
//         name,
//         abn_number,
//         timezone_id,
//         address_id,
//         bank_name,
//         account_name,
//         account_number,
//         account_bsb,
//         email_signature_logo,
//         company_logo
//       )
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//       RETURNING *;
//     `;

//     const values = [
//       builderId,
//       payload.name,
//       payload.abn_number,
//       payload.timezone_id,
//       addressId,
//       payload.bank_name,
//       payload.account_name,
//       payload.account_number,
//       payload.account_bsb,
//       payload.email_signature_logo,
//       payload.company_logo,
//     ];

//     const insertResult = await client.query(insertQuery, values);

//     const company = insertResult.rows[0];

//     // LINK COMPANY → BUILDER
//     await client.query(
//       `
//     UPDATE builder
//     SET company_id = $1, updated_at = NOW()
//     WHERE builder_id = $2
//     `,
//       [company.company_id, builderId],
//     );

//     return mapTimezone(insertResult.rows[0]);
//   }

//   // For update, preserve existing values for fields not provided in payload
//   const updateQuery = `
//     UPDATE company
//     SET
//       name = COALESCE($2, name),
//       abn_number = COALESCE($3, abn_number),
//       timezone_id = COALESCE($4, timezone_id),
//       address_id = COALESCE($5, address_id),
//       bank_name = COALESCE($6, bank_name),
//       account_name = COALESCE($7, account_name),
//       account_number = COALESCE($8, account_number),
//       account_bsb = COALESCE($9, account_bsb),
//       email_signature_logo = COALESCE($10, email_signature_logo),
//       company_logo = COALESCE($11, company_logo),
//       updated_at = NOW()
//     WHERE builder_id = $1
//     RETURNING *;
//   `;

//   const values = [
//     builderId,
//     payload.name !== undefined ? payload.name : null,
//     payload.abn_number !== undefined ? payload.abn_number : null,
//     payload.timezone_id !== undefined ? payload.timezone_id : null,
//     addressId !== undefined ? addressId : null,
//     payload.bank_name !== undefined ? payload.bank_name : null,
//     payload.account_name !== undefined ? payload.account_name : null,
//     payload.account_number !== undefined ? payload.account_number : null,
//     payload.account_bsb !== undefined ? payload.account_bsb : null,
//     payload.email_signature_logo !== undefined
//       ? payload.email_signature_logo
//       : null,
//     payload.company_logo !== undefined ? payload.company_logo : null,
//   ];

//   const updateResult = await client.query(updateQuery, values);

//   return mapTimezone(updateResult.rows[0]);
// }

export async function getCompanyService({ builderId }) {

  const company = await db.Company.findOne({
    where: { builder_id: builderId },
  });

  if (!company) {
    const error = new Error("Company not found");
    error.status = 404;
    throw error;
  }

  return keysToCamelCase(company?.toJSON() ?? null);
}
//without tra
// // // ─── Helper: attach timezone array to company plain object ───────────────────
// // async function attachTimezone(companyData) {
// //   if (!companyData) return null;

// //   if (companyData.timezone_id) {
// //     const tz = await db.Timezones.findOne({
// //       where: { timezone_id: companyData.timezone_id },
// //       attributes: ["timezone_id", "timezone_name"],
// //     });

// //     companyData.timezone = tz
// //       ? [tz.timezone_id, tz.timezone_name]
// //       : null;
// //   } else {
// //     companyData.timezone = null;
// //   }

// //   return keysToCamelCase(companyData);
// // }

// // ─── Attach timezone array [id, name] to a plain company object ──────────────
// async function attachTimezone(companyPlain, transaction = null) {
//   if (!companyPlain) return null;
//   if (companyPlain.timezone_id) {
//     const tz = await db.Timezones.findOne({
//       where: { timezone_id: companyPlain.timezone_id },
//       attributes: ["timezone_id", "timezone_name"],
//       transaction,
//     });

//     companyPlain.timezone = tz
//       ? [tz.timezone_id, tz.timezone_name]
//       : null;
//   } else {
//     companyPlain.timezone = null;
//   }

//   return keysToCamelCase(companyPlain);
// }

// // ─── Fetch company + nested address by builderId ─────────────────────────────
// async function getCompanyByBuilderId(builderId, transaction = null) {
//   const company = await db.Company.findOne({
//     where: { builder_id: builderId },
//     include: [
//       {
//         model: db.Address,
//         as: "address",
//         attributes: [
//           "address_line1",
//           "address_line2",
//           "city",
//           "state_id",
//           "country_id",
//           "zip_code",
//         ],
//       },
//     ],
//     transaction,
//   });

//   if (!company) return null;

//   const plain = company.toJSON();

//   // Nest address fields into address object (matching original shape)
//   if (plain.address_id && plain.address) {
//     plain.address = {
//       address_line1: plain.address.address_line1,
//       address_line2: plain.address.address_line2,
//       city: plain.address.city,
//       state_id: plain.address.state_id,
//       country_id: plain.address.country_id,
//       zip_code: plain.address.zip_code,
//     };
//   }

//   return attachTimezone(plain, transaction);
// }

// // ─── Main upsert service ──────────────────────────────────────────────────────
// export async function upsertCompanyService(builderId, payload, transaction = null) {
//   const existingCompany = await getCompanyByBuilderId(builderId, transaction);

//   // Handle address upsert
//   let addressId = null;
//   if (payload.address) {
//     addressId = await addressRepo.createOrUpdateAddress(
//       existingCompany?.addressId || null,
//       payload.address,
//       transaction,
//     );
//   } else if (existingCompany?.addressId) {
//     // Keep existing address if no new address provided
//     addressId = existingCompany.addressId;
//   }

//   // ── INSERT ──────────────────────────────────────────────────────────────────
//   if (!existingCompany) {
//     const newCompany = await db.Company.create({
//       builder_id: builderId,
//       name: payload.name,
//       abn_number: payload.abn_number,
//       timezone_id: payload.timezone_id,
//       address_id: addressId,
//       bank_name: payload.bank_name,
//       account_name: payload.account_name,
//       account_number: payload.account_number,
//       account_bsb: payload.account_bsb,
//       email_signature_logo: payload.email_signature_logo,
//       company_logo: payload.company_logo,
//     }, { transaction });

//     // Link company → builder
//     await db.Builder.update(
//       { company_id: newCompany.company_id },
//       { where: { builder_id: builderId }, transaction },
//     );
//     return attachTimezone(newCompany.toJSON(), transaction);
//   }

//   // ── UPDATE (preserve existing values for fields not provided — COALESCE behaviour) ─
//   const updatePayload = {};

//   if (payload.name !== undefined) updatePayload.name = payload.name;
//   if (payload.abn_number !== undefined) updatePayload.abn_number = payload.abn_number;
//   if (payload.timezone_id !== undefined) updatePayload.timezone_id = payload.timezone_id;
//   if (addressId !== null) updatePayload.address_id = addressId;
//   if (payload.bank_name !== undefined) updatePayload.bank_name = payload.bank_name;
//   if (payload.account_name !== undefined) updatePayload.account_name = payload.account_name;
//   if (payload.account_number !== undefined) updatePayload.account_number = payload.account_number;
//   if (payload.account_bsb !== undefined) updatePayload.account_bsb = payload.account_bsb;
//   if (payload.email_signature_logo !== undefined) updatePayload.email_signature_logo = payload.email_signature_logo;
//   if (payload.company_logo !== undefined) updatePayload.company_logo = payload.company_logo;

//   const [, [updatedCompany]] = await db.Company.update(updatePayload, {
//     where: { builder_id: builderId },
//     returning: true,
//     transaction,
//   });

//   return attachTimezone(updatedCompany.toJSON(), transaction);
// }

// ── Attach timezone array [id, name] to plain company object ─────────────────
async function attachTimezone(companyPlain, t) {
  if (!companyPlain) return null;

  if (companyPlain.timezone_id) {
    const tz = await db.Timezones.findOne({
      where: { timezone_id: companyPlain.timezone_id },
      attributes: ["timezone_id", "timezone_name"],
      transaction: t,
    });
    companyPlain.timezone = tz ? [tz.timezone_id, tz.timezone_name] : null;
  } else {
    companyPlain.timezone = null;
  }

  return keysToCamelCase(companyPlain);
}

// ── Fetch company with nested address ────────────────────────────────────────
async function getCompanyWithAddress(builderId, t) {
  const company = await db.Company.findOne({
    where: { builder_id: builderId },
    include: [
      {
        association: "address",
        attributes: ["address_line1", "address_line2", "city", "state_id", "country_id", "zip_code"],
      },
    ],
    transaction: t,
  });

  if (!company) return null;

  const plain = company.toJSON();

  if (plain.address_id && plain.address) {
    plain.address = {
      address_line1: plain.address.address_line1,
      address_line2: plain.address.address_line2,
      city: plain.address.city,
      state_id: plain.address.state_id,
      country_id: plain.address.country_id,
      zip_code: plain.address.zip_code,
    };
  }

  return attachTimezone(plain, t);
}

// // ── Main upsert service ───────────────────────────────────────────────────────
// export async function upsertCompanyService(builderId, payload,) {
//   const t = await db.sequelize.transaction();
//   try {
//     const existingCompany = await getCompanyWithAddress(builderId, t);

//     // ── Address upsert ────────────────────────────────────────────────────────
//     let addressId = null;
//     if (payload.address) {
//       addressId = await createOrUpdateAddress(existingCompany?.addressId || null, payload.address, t);
//     } else if (existingCompany?.addressId) {
//       addressId = existingCompany.addressId;
//     }

//     let result;

//     if (!existingCompany) {
//       // ── INSERT ──────────────────────────────────────────────────────────────
//       const newCompany = await db.Company.create({
//         builder_id: builderId,
//         name: payload.name,
//         abn_number: payload.abn_number,
//         timezone_id: payload.timezone_id,
//         address_id: addressId,
//         bank_name: payload.bank_name,
//         account_name: payload.account_name,
//         account_number: payload.account_number,
//         account_bsb: payload.account_bsb,
//         email_signature_logo: payload.email_signature_logo,
//         company_logo: payload.company_logo,
//       }, { transaction: t });

//       // Link company → builder
//       await db.Builder.update(
//         { company_id: newCompany.company_id },
//         { where: { builder_id: builderId }, transaction: t },
//       );

//       result = await attachTimezone(newCompany.toJSON(), t);
//     } else {
//       // ── UPDATE ──────────────────────────────────────────────────────────────
//       const updatePayload = {};

//       if (payload.name !== undefined) updatePayload.name = payload.name;
//       if (payload.abn_number !== undefined) updatePayload.abn_number = payload.abn_number;
//       if (payload.timezone_id !== undefined) updatePayload.timezone_id = payload.timezone_id;
//       if (addressId !== null) updatePayload.address_id = addressId;
//       if (payload.bank_name !== undefined) updatePayload.bank_name = payload.bank_name;
//       if (payload.account_name !== undefined) updatePayload.account_name = payload.account_name;
//       if (payload.account_number !== undefined) updatePayload.account_number = payload.account_number;
//       if (payload.account_bsb !== undefined) updatePayload.account_bsb = payload.account_bsb;
//       if (payload.email_signature_logo !== undefined) updatePayload.email_signature_logo = payload.email_signature_logo;
//       if (payload.company_logo !== undefined) updatePayload.company_logo = payload.company_logo;

//       const [, [updatedCompany]] = await db.Company.update(updatePayload, {
//         where: { builder_id: builderId },
//         returning: true,
//         transaction: t,
//       });

//       result = await attachTimezone(updatedCompany.toJSON(), t);
//     }

//     await t.commit();
//     return result;
//   } catch (err) {
//     await t.rollback();
//     throw err;
//   }
// }

export async function upsertCompanyService(builderId, payload, transaction = null) {
  const isExternalTransaction = !!transaction;
  const t = transaction || await db.sequelize.transaction();
  try {
    const existingCompany = await getCompanyWithAddress(builderId, t);

    // ── Address upsert ────────────────────────────────────────────────────────
    let addressId = null;
    if (payload.address) {
      addressId = await createOrUpdateAddress(existingCompany?.addressId || null, payload.address, t);
    } else if (existingCompany?.addressId) {
      addressId = existingCompany.addressId;
    }

    let result;

    if (!existingCompany) {
      // ── INSERT ──────────────────────────────────────────────────────────────
      const newCompany = await db.Company.create({
        builder_id: builderId,
        name: payload.name,
        abn_number: payload.abn_number,
        timezone_id: payload.timezone_id,
        address_id: addressId,
        bank_name: payload.bank_name,
        account_name: payload.account_name,
        account_number: payload.account_number,
        account_bsb: payload.account_bsb,
        email_signature_logo: payload.email_signature_logo,
        company_logo: payload.company_logo,
      }, { transaction: t });

      // Link company → builder
      await db.Builder.update(
        { company_id: newCompany.company_id },
        { where: { builder_id: builderId }, transaction: t },
      );

      result = await attachTimezone(newCompany.toJSON(), t);
    } else {
      // ── UPDATE ──────────────────────────────────────────────────────────────
      const updatePayload = {};

      if (payload.name !== undefined) updatePayload.name = payload.name;
      if (payload.abn_number !== undefined) updatePayload.abn_number = payload.abn_number;
      if (payload.timezone_id !== undefined) updatePayload.timezone_id = payload.timezone_id;
      if (addressId !== null) updatePayload.address_id = addressId;
      if (payload.bank_name !== undefined) updatePayload.bank_name = payload.bank_name;
      if (payload.account_name !== undefined) updatePayload.account_name = payload.account_name;
      if (payload.account_number !== undefined) updatePayload.account_number = payload.account_number;
      if (payload.account_bsb !== undefined) updatePayload.account_bsb = payload.account_bsb;
      if (payload.email_signature_logo !== undefined) updatePayload.email_signature_logo = payload.email_signature_logo;
      if (payload.company_logo !== undefined) updatePayload.company_logo = payload.company_logo;

      const [, [updatedCompany]] = await db.Company.update(updatePayload, {
        where: { builder_id: builderId },
        returning: true,
        transaction: t,
      });

      result = await attachTimezone(updatedCompany.toJSON(), t);
    }

    if (!isExternalTransaction) await t.commit();
    return result;
  } catch (err) {
    if (!isExternalTransaction) await t.rollback();
    throw err;
  }
}