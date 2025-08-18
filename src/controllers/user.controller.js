const { successResponse, errorResponse } = require('../helper/response');
const getPool = require('../config/database');
const bcrypt = require('bcrypt');

exports.createUser = async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return errorResponse(res, 400, 'User already exists with this email');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await client.query(
            'INSERT INTO users(name, email, password) VALUES($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        
        return successResponse(res, {
            statusCode: 201,
            message: 'User registered successfully',
            data: {
                user: result.rows[0],
                token
            },
            requestId: req.requestId
        });
    } catch (err) {
        console.error('Registration error:', err);
        return errorResponse(res, 500, 'Error registering user');
    } finally {
        client.release();
    }
};

exports.loginUser = async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }
        
        // Find user by email
        const result = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, 401, 'Invalid email or password');
        }

        const user = result.rows[0];
        
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return errorResponse(res, 401, 'Invalid email or password');
        }

        // Generate token
        const token = generateToken(user.id);
        
        // Remove password from response
        delete user.password;
        
        return successResponse(res, {
            statusCode: 200,
            message: 'Login successful',
            data: {
                user,
                token
            },
            requestId: req.requestId
        });
    } catch (err) {
        console.error('Login error:', err);
        return errorResponse(res, 500, 'Error during login');
    } finally {
        client.release();
    }
};