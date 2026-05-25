const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgresadmin',
    host: process.env.DB_HOST || 'servidorgastos.postgres.database.azure.com',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD || 'Sebas27082005',
    port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Test de conexión
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error al conectar a la base de datos:', err.stack);
    }
    console.log('✅ Conectado a PostgreSQL');
    release();
});

// ============= RUTAS DE CATEGORÍAS =============

// Obtener todas las categorías
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// Crear nueva categoría
app.post('/api/categories', async (req, res) => {
    const { name, color, icon } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO categories (name, color, icon) VALUES ($1, $2, $3) RETURNING *',
            [name, color, icon]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});

// ============= RUTAS DE GASTOS =============

// Obtener todos los gastos
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, c.name as category_name, c.color, c.icon
            FROM expenses e
            LEFT JOIN categories c ON e.category_id = c.id
            ORDER BY e.date DESC, e.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

// Obtener gastos por rango de fechas
app.get('/api/expenses/range', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const result = await pool.query(`
            SELECT e.*, c.name as category_name, c.color, c.icon
            FROM expenses e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE e.date BETWEEN $1 AND $2
            ORDER BY e.date DESC, e.created_at DESC
        `, [startDate, endDate]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

// Crear nuevo gasto
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category_id, date } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO expenses (description, amount, category_id, date) VALUES ($1, $2, $3, $4) RETURNING *',
            [description, amount, category_id, date]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear gasto' });
    }
});

// Actualizar gasto
app.put('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const { description, amount, category_id, date } = req.body;
    try {
        const result = await pool.query(
            'UPDATE expenses SET description = $1, amount = $2, category_id = $3, date = $4 WHERE id = $5 RETURNING *',
            [description, amount, category_id, date, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar gasto' });
    }
});

// Eliminar gasto
app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
        res.json({ message: 'Gasto eliminado exitosamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar gasto' });
    }
});

// ============= RUTAS DE ESTADÍSTICAS =============

// Obtener resumen de gastos
app.get('/api/statistics/summary', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        const [total, monthly, byCategory] = await Promise.all([
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses'),
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= $1', [firstDayMonth]),
            pool.query(`
                SELECT c.name, c.color, c.icon, COALESCE(SUM(e.amount), 0) as total
                FROM categories c
                LEFT JOIN expenses e ON c.id = e.category_id AND e.date >= $1
                GROUP BY c.id, c.name, c.color, c.icon
                ORDER BY total DESC
            `, [firstDayMonth])
        ]);

        res.json({
            total: parseFloat(total.rows[0].total),
            monthly: parseFloat(monthly.rows[0].total),
            byCategory: byCategory.rows.map(row => ({
                ...row,
                total: parseFloat(row.total)
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Obtener gastos mensuales de los últimos 6 meses
app.get('/api/statistics/monthly', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', date), 'Mon YYYY') as month,
                SUM(amount) as total
            FROM expenses
            WHERE date >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', date)
            ORDER BY DATE_TRUNC('month', date) ASC
        `);
        res.json(result.rows.map(row => ({
            month: row.month,
            total: parseFloat(row.total)
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener estadísticas mensuales' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});