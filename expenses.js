// ══════════════════════════════════════════════════════════════
// Rutas de Gastos
// ══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { initDB } = require('../services/database');

// ─── GET /api/expenses — Listar gastos ──────────────────────
router.get('/', (req, res) => {
  const db = initDB();
  const { period = 'week', limit = 50 } = req.query;

  let dateFilter = '';
  if (period === 'week') dateFilter = "AND e.created_at >= datetime('now', '-7 days')";
  else if (period === 'month') dateFilter = "AND e.created_at >= datetime('now', '-30 days')";

  const expenses = db.prepare(`
    SELECT e.*, c.name as category_name, c.emoji as category_emoji, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE 1=1 ${dateFilter}
    ORDER BY e.created_at DESC
    LIMIT ?
  `).all(parseInt(limit));

  res.json(expenses);
});

// ─── GET /api/expenses/stats — Estadísticas ─────────────────
router.get('/stats', (req, res) => {
  const db = initDB();
  const { period = 'week' } = req.query;

  let dateFilter = '';
  if (period === 'week') dateFilter = "AND created_at >= datetime('now', '-7 days')";
  else if (period === 'month') dateFilter = "AND created_at >= datetime('now', '-30 days')";

  // Total y conteo
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(amount), 0) as total,
      COUNT(*) as count,
      COALESCE(AVG(amount), 0) as average
    FROM expenses
    WHERE 1=1 ${dateFilter}
  `).get();

  // Por categoría
  const byCategory = db.prepare(`
    SELECT 
      c.id, c.name, c.emoji, c.color,
      COALESCE(SUM(e.amount), 0) as total,
      COUNT(e.id) as count
    FROM categories c
    LEFT JOIN expenses e ON e.category_id = c.id ${dateFilter ? dateFilter.replace('AND', 'AND e.') : ''}
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `).all();

  // Por día (últimos 7 días)
  const byDay = db.prepare(`
    SELECT 
      date(created_at) as day,
      SUM(amount) as total,
      COUNT(*) as count
    FROM expenses
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY day DESC
  `).all();

  res.json({
    total: totals.total,
    count: totals.count,
    average: Math.round(totals.average),
    byCategory,
    byDay,
  });
});

// ─── POST /api/expenses — Crear gasto manual ────────────────
router.post('/', (req, res) => {
  const db = initDB();
  const { description, amount, category_id, merchant } = req.body;

  if (!description || !amount) {
    return res.status(400).json({ error: 'Descripción y monto son requeridos' });
  }

  const result = db.prepare(`
    INSERT INTO expenses (description, amount, merchant, category_id, status, created_at, classified_at)
    VALUES (?, ?, ?, ?, 'classified', datetime('now'), datetime('now'))
  `).run(description, amount, merchant || description, category_id);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(expense);
});

// ─── PUT /api/expenses/:id — Clasificar gasto ───────────────
router.put('/:id', (req, res) => {
  const db = initDB();
  const { category_id } = req.body;
  const { id } = req.params;

  db.prepare(`
    UPDATE expenses 
    SET category_id = ?, status = 'classified', classified_at = datetime('now')
    WHERE id = ?
  `).run(category_id, id);

  const expense = db.prepare(`
    SELECT e.*, c.name as category_name, c.emoji as category_emoji
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id = ?
  `).get(id);

  res.json(expense);
});

// ─── DELETE /api/expenses/:id — Eliminar gasto ──────────────
router.delete('/:id', (req, res) => {
  const db = initDB();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
