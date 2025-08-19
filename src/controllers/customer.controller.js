const getPool = require("../config/database");
const {errorResponse} = require("../helper/response");
const {keysToCamelCase} = require("../utils/common");
const {successResponse} = require("../helper/response");

exports.createCustomer = async (req, res) => {
    const {name, email, builderId, phone, address} = req.body || {};
    const lowerCaseEmail = email.toLowerCase();

    const pool = getPool();
    const client = await pool.connect();

    try {
        // Check if builder exists
        const builderQuery = `SELECT *
                              FROM builder
                              WHERE builder_id = $1;`;
        const builderResult = await client.query(builderQuery, [builderId]);

        if (builderResult.rows.length === 0) {
            return errorResponse(res, 404, "Builder not found with the provided ID.");
        }

        // Check if customer already exists with the same email and builder
        const existingCustomerQuery = `
            SELECT customer_id, email
            FROM customer
            WHERE LOWER(email) = $1
              AND builder_id = $2;
        `;
        const existingCustomerResult = await client.query(existingCustomerQuery, [
            lowerCaseEmail,
            builderId
        ]);

        if (existingCustomerResult.rows.length > 0) {
            return errorResponse(res, 409, "Customer with this email already exists for this builder.");
        }

        const customerQuery = `
            INSERT INTO customer (name, email, builder_id, phone, address)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const customerResult = await client.query(customerQuery, [
            name,
            lowerCaseEmail,
            builderId,
            phone,
            address
        ]);

        const createdCustomer = customerResult.rows[0];
        return successResponse(
            res,
            {
                ...createdCustomer,
            },
            "Customer created successfully."
        );

    } catch (error) {
        console.error('Create customer error:', error);

        if (error.constraint === 'customer_email_key') {
            return errorResponse(res, 409,
                "Customer with this email already exists.");
        }

        return errorResponse(res, 500,
            "Failed to create customer.");
    } finally {
        client.release();
    }
};

exports.getCustomers = async (req, res) => {
    const builderId = req.user.builder_id;

    const pool = getPool();
    const client = await pool.connect();

    try {
        const query = `
            SELECT *
            FROM customer
            WHERE builder_id = $1
              AND is_deleted = false;
        `;
        const result = await client.query(query, [builderId]);

        return successResponse(
            res,
            keysToCamelCase(result.rows),
            "Customers fetched successfully."
        );
    } catch (error) {
        console.error("Get customers error:", error);
        return errorResponse(res, 500, "Internal Server Error");
    } finally {
        client.release();
    }
};

exports.getCustomerById = async (req, res) => {
    const {id} = req.params;
    const builderId = req.user.builder_id;

    const pool = getPool();
    const client = await pool.connect();

    try {
        const query = `
            SELECT *
            FROM customer
            WHERE customer_id = $1
              AND builder_id = $2
              AND is_deleted = false;
        `;
        const result = await client.query(query, [id, builderId]);

        if (result.rowCount === 0) {
            return errorResponse(res, 404, "Customer not found.");
        }

        return successResponse(
            res,
            keysToCamelCase(result.rows[0]),
            "Customer fetched successfully."
        );
    } catch (error) {
        console.error("Get customer by ID error:", error);
        return errorResponse(res, 500, "Internal Server Error");
    } finally {
        client.release();
    }
};

exports.updateCustomer = async (req, res) => {
    const {id} = req.params;
    const builderId = req.user.builder_id;
    const updates = req.body;

    // updates.email = undefined;
    // updates.builder_id = undefined;
    // updates.customer_id = undefined;
    // updates.is_deleted = undefined;
    // updates.updated_at = undefined;
    // updates.created_at = undefined;


    const pool = getPool();
    const client = await pool.connect();

    try {
        const checkCustomerQuery = `
            SELECT *
            FROM customer
            WHERE customer_id = $1
              AND builder_id = $2
              AND is_deleted = false;
        `;
        const checkCustomerResult = await client.query(checkCustomerQuery, [id, builderId]);

        if (checkCustomerResult.rowCount === 0) {
            return errorResponse(res, 404, "Customer not found.");
        }

        const setClauses = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = $${idx}`);
            values.push(value);
            idx++;
        }

        values.push(id, builderId);

        const updateQuery = `
            UPDATE customer
            SET ${setClauses.join(", ")},
                updated_at = NOW()
            WHERE customer_id = $${idx}
              AND builder_id = $${idx + 1} RETURNING *;
        `;

        const updateResult = await client.query(updateQuery, values);

        if (updateResult.rowCount === 0) {
            return errorResponse(res, 404, "Customer not found.");
        }

        return successResponse(
            res,
            keysToCamelCase(updateResult.rows[0]),
            "Customer updated successfully."
        );

    } catch (error) {
        console.error("Error updating customer:", error);
        if (error.constraint === 'customer_email_key') {
            return errorResponse(res, 409, "Email already exists");
        }
        return errorResponse(res, 500, "Internal Server Error");
    } finally {
        client.release();
    }
};

exports.deleteCustomer = async (req, res) => {
    const {id} = req.params;
    const builderId = req.user.builder_id;

    const pool = getPool();
    const client = await pool.connect();

    try {
        const checkBuilderQuery = `SELECT *
                                   FROM customer
                                   WHERE customer_id = $1
                                     AND builder_id = $2
                                     AND is_deleted = false;`;
        const checkBuilderResult = await client.query(checkBuilderQuery, [id, builderId]);

        if (checkBuilderResult.rowCount === 0) {
            return errorResponse(res, 404, "customer not found.");
        }

        const deleteQuery = `
            DELETE
            FROM customer
            WHERE customer_id = $1
              AND builder_id = $2
              AND is_deleted = false RETURNING *;
        `;
        const deleteResult = await client.query(deleteQuery, [id, builderId]);

        if (deleteResult.rowCount === 0) {
            return errorResponse(res, 404, "Customer not found.");
        }

        return successResponse(res, {}, "Customer deleted successfully.");
    } catch (error) {
        console.error("Error deleting customer:", error);
        return errorResponse(res, 500, "Internal Server Error");
    } finally {
        client.release();
    }
};