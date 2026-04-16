// ══════════════════════════════════════════════════════════════
// Rutas de Webhooks — Twilio WhatsApp
// ══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { handleWhatsAppReply } = require('../services/whatsapp');

// ─── POST /webhooks/whatsapp — Recibir respuesta WhatsApp ───
// Twilio envía aquí cuando el usuario responde al mensaje
router.post('/whatsapp', async (req, res) => {
  try {
    const { Body, From, To, MessageSid } = req.body;

    console.log(`📩 WhatsApp recibido de ${From}: "${Body}"`);

    await handleWhatsAppReply(Body, From);

    // Twilio espera una respuesta TwiML vacía
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    console.error('❌ Error en webhook WhatsApp:', error);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

// ─── POST /webhooks/bank — Recibir desde iOS Shortcut ───────
// El atajo de iOS envía aquí el texto de la notificación
router.post('/bank', async (req, res) => {
  try {
    // iOS Shortcuts envía el texto en distintos formatos
    const text = req.body.text || req.body.notification || req.body.content || '';
    
    if (!text) {
      return res.status(400).json({ error: 'No se recibió texto' });
    }

    // Redirigir al handler principal
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/bank-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY,
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ Error en webhook banco:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
