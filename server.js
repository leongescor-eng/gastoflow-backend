require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDB } = require('./services/database');
const { sendWhatsAppPoll, handleWhatsAppReply } = require('./services/whatsapp');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const auth = (req, res, next) => {
  if (req.path.startsWith('/webhooks') || req.path === '/health') return next();
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (key !== process.env.API_KEY) return res.status(401).json({ error: 'API key invalida' });
  next();
};
app.use(auth);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.post('/api/bank-notification', async (req, res) => {
  try {
    const { text } = req.body;
    const parsed = parseBankNotification(text);
    if (!parsed) return res.status(400).json({ error: 'No se pudo interpretar' });
    const db = initDB();
    const expense = db.addExpense({ description: parsed.merchant, amount: parsed.amount, merchant: parsed.merchant, status: 'pending', category_id: null, bank_raw: text });
    const categories = db.getCategories();
    await sendWhatsAppPoll(expense.id, parsed, categories);
    res.json({ success: true, expenseId: expense.id, parsed });
  } catch(e) { console.error('Error:', e); res.status(500).json({ error: e.message }); }
});
app.get('/api/expenses', (req, res) => { const db=initDB(); res.json(db.getExpenses(req.query.period)); });
app.get('/api/expenses/stats', (req, res) => { const db=initDB(); res.json(db.getStats(req.query.period)); });
app.post('/api/expenses', (req, res) => { const db=initDB(); const {description,amount,category_id,merchant}=req.body; if(!description||!amount) return res.status(400).json({error:'Faltan datos'}); const expense=db.addExpense({description,amount,merchant:merchant||description,category_id,status:'classified',classified_at:new Date().toISOString()}); res.status(201).json(expense); });
app.put('/api/expenses/:id', (req, res) => { const db=initDB(); const exp=db.updateExpense(parseInt(req.params.id),{category_id:req.body.category_id,status:'classified',classified_at:new Date().toISOString()}); res.json(exp); });
app.delete('/api/expenses/:id', (req, res) => { const db=initDB(); db.deleteExpense(parseInt(req.params.id)); res.json({success:true}); });
app.get('/api/categories', (req, res) => { const db=initDB(); res.json(db.getCategories()); });
app.post('/api/categories', (req, res) => { const db=initDB(); const cat=db.addCategory({name:req.body.name,emoji:req.body.emoji||'📦',color:req.body.color||'#8888a0'}); res.status(201).json(cat); });
app.post('/webhooks/whatsapp', async (req, res) => { try { await handleWhatsAppReply(req.body.Body, req.body.From); } catch(e) { console.error('Webhook error:',e); } res.set('Content-Type','text/xml'); res.send('<Response></Response>'); });
app.post('/webhooks/bank', async (req, res) => { const text=req.body.text||req.body.notification||req.body.content||''; if(!text) return res.status(400).json({error:'Sin texto'}); try { const db=initDB(); const parsed=parseBankNotification(text); if(!parsed) return res.status(400).json({error:'No se pudo interpretar'}); const expense=db.addExpense({description:parsed.merchant,amount:parsed.amount,merchant:parsed.merchant,status:'pending',category_id:null,bank_raw:text}); const categories=db.getCategories(); await sendWhatsAppPoll(expense.id,parsed,categories); res.json({success:true,expenseId:expense.id,parsed}); } catch(e) { res.status(500).json({error:e.message}); } });
function parseBankNotification(text) { if(!text) return null; const patterns=[/compra.*?\$\s?([\d.,]+).*?en\s+(.+?)(?:\s+con|\s*$)/i,/pago.*?\$\s?([\d.,]+).*?en\s+(.+?)(?:\s+con|\s*$)/i,/\$\s?([\d.,]+).*?(?:en\s+)?([A-Za-z\u00C0-\u00FF\s]{3,})/i]; for(const p of patterns){const m=text.match(p);if(m){return{amount:parseInt(m[1].replace(/\./g,'').replace(',','')),merchant:m[2].trim(),raw:text};}} const am=text.match(/\$\s?([\d.,]+)/); if(am) return{amount:parseInt(am[1].replace(/\./g,'').replace(',','')),merchant:'Compra',raw:text}; return null; }
app.listen(PORT, () => { console.log('\n🟢 GastoFlow Backend corriendo en puerto ' + PORT); console.log('   Health: http://localhost:' + PORT + '/health\n'); });
