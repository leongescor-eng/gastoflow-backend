// ══════════════════════════════════════════════════════════════
// Rutas de Categorías
// ══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { initDB } = require('../services/database');

// ─── GET /api/categories — Listar categorías ────────────────
router.get('/', (req, res) => {
  const db = initDB();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

// ─── POST /api/categories — Crear categoría ─────────────────
router.post('/', (req, res) => {
  const db = initDB();
  const { name, emoji = '📦', color = '#8888a0' } = req.body;

  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
  const result = db.prepare(
    'INSERT INTO categories (name, emoji, color, sort_order) VALUES (?, ?, ?, ?)'
  ).run(name, emoji, color, (maxOrder.m || 0) + 1);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// ─── DELETE /api/categories/:id — Eliminar categoría ────────
router.delete('/:id', (req, res) => {
  const db = initDB();
  const { id } = req.params;

  // Mover gastos de esta categoría a "Otros"
  const otros = db.prepare("SELECT id FROM categories WHERE name = 'Otros' LIMIT 1").get();
  if (otros) {
    db.prepare('UPDATE expenses SET category_id = ? WHERE category_id = ?').run(otros.id, id);
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
