const express = require('express');
const cors = require('cors');
const sql = require('mssql');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración Azure SQL
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Conexión a SQL Server
sql.connect(config)
    .then(() => {
        console.log('✅ Conectado a Azure SQL Database');
    })
    .catch(err => {
        console.error('❌ Error conexión SQL:', err);
    });

// Middleware
app.use(cors());
app.use(express.json());


// ================= CATEGORÍAS =================

// Obtener categorías
app.get('/api/categories', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT * FROM categories ORDER BY name
        `);

        res.json(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// Crear categoría
app.post('/api/categories', async (req, res) => {
    const { name, color, icon } = req.body;

    try {
        const result = await sql.query(`
            INSERT INTO categories (name, color, icon)
            OUTPUT INSERTED.*
            VALUES ('${name}', '${color}', '${icon}')
        `);

        res.status(201).json(result.recordset[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});


// ================= GASTOS =================

// Obtener gastos
app.get('/api/expenses', async (req, res) => {
    try {

        const result = await sql.query(`
            SELECT 
                e.*,
                c.name as category_name,
                c.color,
                c.icon
            FROM expenses e
            LEFT JOIN categories c 
                ON e.category_id = c.id
            ORDER BY e.date DESC
        `);

        res.json(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

// Crear gasto
app.post('/api/expenses', async (req, res) => {

    const { description, amount, category_id, date } = req.body;

    try {

        const result = await sql.query(`
            INSERT INTO expenses 
                (description, amount, category_id, date)
            OUTPUT INSERTED.*
            VALUES (
                '${description}',
                ${amount},
                ${category_id},
                '${date}'
            )
        `);

        res.status(201).json(result.recordset[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear gasto' });
    }
});

// Eliminar gasto
app.delete('/api/expenses/:id', async (req, res) => {

    const { id } = req.params;

    try {

        await sql.query(`
            DELETE FROM expenses
            WHERE id = ${id}
        `);

        res.json({
            message: 'Gasto eliminado exitosamente'
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Error al eliminar gasto'
        });
    }
});


// ================= ESTADÍSTICAS =================

// Resumen
app.get('/api/statistics/summary', async (req, res) => {

    try {

        const total = await sql.query(`
            SELECT ISNULL(SUM(amount),0) as total
            FROM expenses
        `);

        const monthly = await sql.query(`
            SELECT ISNULL(SUM(amount),0) as total
            FROM expenses
            WHERE MONTH(date) = MONTH(GETDATE())
            AND YEAR(date) = YEAR(GETDATE())
        `);

        res.json({
            total: total.recordset[0].total,
            monthly: monthly.recordset[0].total
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Error al obtener estadísticas'
        });
    }
});


// ================= SERVIDOR =================

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});