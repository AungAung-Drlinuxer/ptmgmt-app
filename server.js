// Load environment variables from .env file (created by user_data.sh or manually)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const mysql = require('mysql2/promise');

// Express App Initialization
const app = express();
app.use(cors());
app.use(express.json()); // Built-in body parser for JSON
app.use(express.static('public')); // Serve static files from 'public' directory

// --- Load Environment Variables ---
const {
    APP_PORT,
    DB_HOST,
    DB_NAME,
    DB_SECRET_ARN,
    AWS_REGION
} = process.env;

// Basic Validation
if (!DB_HOST || !DB_NAME || !DB_SECRET_ARN || !AWS_REGION) {
    console.error("FATAL: Missing required environment variables.");
    process.exit(1);
}

// AWS Secrets Manager client
const secretsManager = new SecretsManagerClient({ region: AWS_REGION });

// Global DB connection pool
let dbPool = null;

/**
 * Retrieve DB credentials securely from AWS Secrets Manager
 */
async function getDbCredentials() {
    console.log(`Fetching database credentials from AWS Secrets Manager...`);
    try {
        const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
        const response = await secretsManager.send(command);

        if (!response.SecretString) throw new Error("Missing SecretString in Secrets Manager response.");

        const secret = JSON.parse(response.SecretString);
        return {
            user: secret.username,
            password: secret.password
        };
    } catch (err) {
        console.error("FATAL: Failed to fetch DB credentials from Secrets Manager.", err);
        throw err;
    }
}

/**
 * Initialize DB pool and ensure table exists
 */
async function initializeDbPool() {
    if (dbPool) return; // already initialized

    const credentials = await getDbCredentials();

    // Parse DB_HOST (support hostname:port)
    let [dbHost, dbPort] = DB_HOST.split(':');
    dbPort = dbPort ? parseInt(dbPort) : 3306;

    console.log(`Connecting to database '${DB_NAME}' at '${dbHost}:${dbPort}'`);

    dbPool = mysql.createPool({
        host: dbHost,
        port: dbPort,
        user: credentials.user,
        password: credentials.password,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Database connection successful. Checking schema...");

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                patient_number VARCHAR(100) NOT NULL
            );
        `;
        await connection.query(createTableQuery);
        console.log("✅ Table 'patients' is ready.");
    } catch (err) {
        console.error("FATAL: Could not initialize database schema.", err);
        throw err;
    } finally {
        if (connection) connection.release();
    }
}

/**
 * API Routes
 */

// Get all patients
app.get('/api/patients', async (req, res) => {
    try {
        const [rows] = await dbPool.query("SELECT * FROM patients ORDER BY id ASC");
        res.json({ patients: rows });
    } catch (err) {
        console.error("Error fetching patients:", err);
        res.status(500).json({ error: "Failed to fetch patients." });
    }
});

// Add a new patient
app.post('/api/patients', async (req, res) => {
    const { name, patientNumber } = req.body;
    if (!name || !patientNumber) {
        return res.status(400).json({ error: "Missing name or patientNumber." });
    }

    try {
        const [result] = await dbPool.query(
            "INSERT INTO patients (name, patient_number) VALUES (?, ?)",
            [name, patientNumber]
        );
        res.status(201).json({ id: result.insertId, name, patient_number: patientNumber });
    } catch (err) {
        console.error("Error inserting patient:", err);
        res.status(500).json({ error: "Failed to add patient." });
    }
});

// Update a patient
app.put('/api/patients/:id', async (req, res) => {
    const { id } = req.params;
    const { name, patientNumber } = req.body;

    if (!name || !patientNumber) {
        return res.status(400).json({ error: "Missing name or patientNumber." });
    }

    try {
        const [result] = await dbPool.query(
            "UPDATE patients SET name = ?, patient_number = ? WHERE id = ?",
            [name, patientNumber, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Patient not found." });
        }

        res.json({ message: "Patient updated successfully." });
    } catch (err) {
        console.error(`Error updating patient ${id}:`, err);
        res.status(500).json({ error: "Failed to update patient." });
    }
});

// Delete a patient
app.delete('/api/patients/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await dbPool.query("DELETE FROM patients WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Patient not found." });
        }

        res.status(204).send(); // No content
    } catch (err) {
        console.error(`Error deleting patient ${id}:`, err);
        res.status(500).json({ error: "Failed to delete patient." });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok", service: "patient-management-api" });
});

/**
 * Start Server
 */
async function startServer() {
    try {
        await initializeDbPool();
        const port = APP_PORT || 5005;
        app.listen(port, () => {
            console.log(`🚀 Patient-Management server running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error("FATAL: Could not start server.", err);
        process.exit(1);
    }
}

startServer();
