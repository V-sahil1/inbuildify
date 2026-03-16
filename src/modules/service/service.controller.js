import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createService(req, res) {
  const { service } = req.body || {};
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderQuery = "SELECT * FROM builder WHERE builder_id = $1;";
    const builderResult = await client.query(builderQuery, [builderId]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found with the provided ID.");
    }

    const existingServiceQuery = `
      SELECT service_id, service FROM service 
      WHERE LOWER(service) = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;
    `;
    const existingServiceResult = await client.query(existingServiceQuery, [
      service.toLowerCase(),
      builderId,
    ]);

    if (existingServiceResult.rows.length > 0) {
      return errorResponse(res, 409, "Service already exists.");
    }

    const serviceQuery = `
      INSERT INTO service (service, builder_id) 
      VALUES ($1, $2) 
      RETURNING service_id, service, builder_id, created_at, updated_at;
    `;
    const serviceResult = await client.query(serviceQuery, [
      service,
      builderId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(serviceResult.rows[0]),
      "Service created successfully.",
    );
  } catch (error) {
    console.error("Create service error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Service already exists.");
    }

    return errorResponse(res, 500, "Failed to create service.");
  } finally {
    client.release();
  }
}

export async function getServices(req, res) {
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT service_id, service, builder_id, created_at, updated_at FROM service 
      WHERE (builder_id IS NULL OR builder_id = $1) AND is_deleted = false
      ORDER BY created_at DESC;
    `;
    const result = await client.query(query, [builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Services retrieved successfully.",
    );
  } catch (error) {
    console.error("Get services error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getServiceById(req, res) {
  const { service_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT service_id, service, builder_id, created_at, updated_at FROM service 
      WHERE service_id = $1 AND (builder_id IS NULL OR builder_id = $2) AND is_deleted = false;
    `;
    const result = await client.query(query, [service_id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Service not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Service fetched successfully.",
    );
  } catch (error) {
    console.error("Get service by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateService(req, res) {
  const { service_id } = req.params;
  const builderId = req.user.builder_id;
  const { service } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkServiceQuery = `
      SELECT * FROM service 
      WHERE service_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkServiceResult = await client.query(checkServiceQuery, [
      service_id,
      builderId,
    ]);

    if (checkServiceResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Service not found or you don't have permission to update this service.",
      );
    }

    const existingServiceQuery = `
      SELECT service_id FROM service 
      WHERE LOWER(service) = $1 AND (builder_id = $2 OR builder_id IS NULL) 
      AND service_id != $3 AND is_deleted = false;
    `;
    const existingServiceResult = await client.query(existingServiceQuery, [
      service.toLowerCase(),
      builderId,
      service_id,
    ]);

    if (existingServiceResult.rows.length > 0) {
      return errorResponse(res, 409, "Service name already exists.");
    }

    const updateQuery = `
      UPDATE service 
      SET service = $1, updated_at = NOW()
      WHERE service_id = $2 AND builder_id = $3
      RETURNING service_id, service, builder_id, created_at, updated_at;
    `;

    const updateResult = await client.query(updateQuery, [
      service,
      service_id,
      builderId,
    ]);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Service not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Service updated successfully.",
    );
  } catch (error) {
    console.error("Error updating service:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Service name already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteService(req, res) {
  const { service_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkServiceQuery = `
      SELECT * FROM service 
      WHERE service_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkServiceResult = await client.query(checkServiceQuery, [
      service_id,
      builderId,
    ]);

    if (checkServiceResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Service not found or you don't have permission to delete this service.",
      );
    }

    const contractorCheckQuery = `
      SELECT COUNT(*) as count FROM contractor 
      WHERE service_id = $1 AND is_deleted = false;
    `;
    const contractorCheckResult = await client.query(contractorCheckQuery, [
      service_id,
    ]);

    if (parseInt(contractorCheckResult.rows[0].count) > 0) {
      return errorResponse(
        res,
        400,
        "Cannot delete service. It is being used by one or more contractors.",
      );
    }

    const deleteQuery = `
      UPDATE service 
      SET is_deleted = true, updated_at = NOW()
      WHERE service_id = $1 AND builder_id = $2;
    `;
    const deleteResult = await client.query(deleteQuery, [
      service_id,
      builderId,
    ]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Service not found.");
    }

    return successResponse(res, {}, "Service deleted successfully.");
  } catch (error) {
    console.error("Error deleting service:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
