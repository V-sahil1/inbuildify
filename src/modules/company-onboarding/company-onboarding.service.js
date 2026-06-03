import { env } from "../../config/env.config.js";
import sendEmail from "../../service/sendMail.service.js";
import { generateOtp } from "../../utils/common.js";
import { encrypt } from "../../utils/crypto.util.js";
import db from "../../config/database/models/postgre-models/index.js";
import { createOrUpdateAddress } from "../../repositories/address.repository.js";
import { seedBuilderDefaults } from "../../seeder/seed-builder-defaults.js";

async function dispatchOtpEmail(email, otp) {
  const subject = "OTP for Email Verification";
  const verificationLink = `${env.EMAIL.FRONTEND_BASE_URL}/auth/verify-email?email=${email}`;
  const text =
    `Your OTP for email verification is: ${otp}\n\n` +
    `Please verify your email by clicking the following link: ${verificationLink}`;
  try {
    return await sendEmail(email, subject, text);
  } catch (error) {
    console.error("Onboarding OTP email error:", error.message);
    return false;
  }
}

const COMPANY_ADMIN_ROLE_NAME = "Company Administrator";

/**
 * Sign-up is locked to the "Company Administrator" role. If the caller
 * omits role_id we resolve it; if they pass one that maps to any other
 * role we reject the request.
 */
async function resolveCompanyAdminRoleId(role_id, transaction) {
  const { Role } = db;

  const companyAdminRole = await Role.findOne({
    where: { name: COMPANY_ADMIN_ROLE_NAME },
    attributes: ["role_id"],
    transaction,
  });
  if (!companyAdminRole) {
    throw {
      statusCode: 500,
      message: `"${COMPANY_ADMIN_ROLE_NAME}" role is not seeded. Run the role seeder before signing up.`,
    };
  }

  if (!role_id) {
    return companyAdminRole.role_id;
  }

  if (role_id !== companyAdminRole.role_id) {
    throw {
      statusCode: 400,
      message: `role_id must be the "${COMPANY_ADMIN_ROLE_NAME}" role for company sign-up.`,
    };
  }

  return companyAdminRole.role_id;
}

/**
 * Phase 1 — dedicated company sign-up.
 *
 * Creates Company + Users (root Company Administrator, unverified) only.
 * No Builder is created here — the Company Administrator creates Builders
 * (and any Sales / Site / Admin sub-users under them) from Settings AFTER
 * onboarding completes. Builder-scoped default settings are seeded at that
 * later step, not here.
 */
export async function companySignUp({
  company_name,
  email,
  password,
  name,
  role_id,
}) {
  const { Users, Company, Builder, sequelize } = db;
  const lowerEmail = email.toLowerCase();

  // In production, bypass email OTP verification for new sign-ups: the user is
  // marked verified immediately and no OTP email is dispatched.
  const bypassOtpVerification = env.NODE_ENV === "production";

  const existingUser = await Users.findOne({
    where: sequelize.where(
      sequelize.fn("LOWER", sequelize.col("email")),
      lowerEmail,
    ),
  });
  if (existingUser) {
    throw { statusCode: 409, message: "A user with this email already exists." };
  }

  const otp = generateOtp();
  const placeholderName =
    name && name.trim().length > 0 ? name.trim() : lowerEmail.split("@")[0];

  const result = await sequelize.transaction(async (t) => {
    const effectiveRoleId = await resolveCompanyAdminRoleId(role_id, t);

    // 1. Company — top-level tenant. Onboarding flag explicitly false.
    const company = await Company.create(
      {
        name: company_name,
        is_onboarding_finished: false,
      },
      { transaction: t },
    );

    // Create a matching Builder record with its builder_id set to company_id
    const builder = await Builder.create(
      {
        builder_id: company.company_id,
        name: company_name,
        company_id: company.company_id,
        email: lowerEmail,
      },
      { transaction: t },
    );

    // Update Company with the new builder_id
    await company.update(
      { builder_id: builder.builder_id },
      { transaction: t },
    );

    // 2. Root Company Administrator user, linked directly to the company and builder.
    const user = await Users.create(
      {
        company_id: company.company_id,
        builder_id: builder.builder_id,
        name: placeholderName,
        email: lowerEmail,
        role_id: effectiveRoleId,
        password: encrypt(password),
        otp: bypassOtpVerification ? null : otp,
        expires_at: bypassOtpVerification
          ? null
          : sequelize.literal("NOW() + INTERVAL '10 minutes'"),
        root_user: true,
        is_verified: bypassOtpVerification,
      },
      { transaction: t },
    );

    // Seed default settings for the new builder
    await seedBuilderDefaults({
      company_id: company.company_id,
      builder_id: builder.builder_id,
      created_by: user.users_id,
      transaction: t,
    });

    return {
      email: lowerEmail,
      companyId: company.company_id,
      usersId: user.users_id,
      isOnboardingFinished: false,
      isVerified: bypassOtpVerification,
    };
  });

  if (!bypassOtpVerification) {
    await dispatchOtpEmail(lowerEmail, otp);
  }

  return result;
}

/**
 * Phase 3 — Onboarding details. Saves company logo and any supplementary
 * fields. Once successful, flips is_onboarding_finished=true.
 *
 * Ownership: the caller's company_id must match the company being patched.
 */
export async function completeCompanyOnboarding(companyId, payload, requesterCompanyId) {
  const { Company } = db;

  const company = await Company.findOne({ where: { company_id: companyId } });
  if (!company) {
    throw { statusCode: 404, message: "Company not found." };
  }

  if (requesterCompanyId && company.company_id !== requesterCompanyId) {
    throw { statusCode: 403, message: "You do not have access to this company." };
  }

  const updatePayload = {};
  if (payload.name !== undefined && payload.name !== null && payload.name !== "") {
    updatePayload.name = payload.name.trim();
  }
  if (payload.company_logo !== undefined && payload.company_logo !== null && payload.company_logo !== "") {
    updatePayload.company_logo = payload.company_logo;
  }
  if (payload.email_signature_logo !== undefined && payload.email_signature_logo !== null && payload.email_signature_logo !== "") {
    updatePayload.email_signature_logo = payload.email_signature_logo;
  }
  if (payload.abn_number !== undefined && payload.abn_number !== "") {
    updatePayload.abn_number = payload.abn_number;
  }
  if (payload.timezone_id !== undefined && payload.timezone_id !== "") {
    updatePayload.timezone_id = payload.timezone_id;
  }

  const { address, website } = payload;

  if (website !== undefined) {
    updatePayload.website = website;
  }

  const t = await db.sequelize.transaction();
  try {
    let addressId = company.address_id;

    if (address) {
      addressId = await createOrUpdateAddress(addressId, address, t);
      updatePayload.address_id = addressId;
    }

    // Phase 3: once submitted, flip the flag.
    updatePayload.is_onboarding_finished = true;

    await Company.update(updatePayload, { where: { company_id: companyId }, transaction: t });

    if (updatePayload.name) {
      await db.Builder.update(
        { name: updatePayload.name },
        { where: { company_id: companyId }, transaction: t }
      );
    }

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  const refreshed = await Company.findByPk(companyId, {
    include: [
      { model: db.Address, as: "address" },
      { model: db.Timezones, as: "timezone" },
    ],
  });
  return refreshed.get({ plain: true });
}

export default {
  companySignUp,
  completeCompanyOnboarding,
};
