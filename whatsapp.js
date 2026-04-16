const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_NUMBER;
const TO = process.env.USER_WHATSAPP_NUMBER;

async function sendWhatsAppPoll(expenseId, parsedData, categories) {
  const amt = '$' + parsedData.amount.toLocaleString('es-CL');
  let msg = '💰 *Nuevo gasto detectado*\n\n';
  msg += '🏪 *' + parsedData.merchant + '*\n';
  msg += '💵 *' + amt + '*\n';
  msg += '🕐 ' + new Date().toLocaleString('es-CL', {timeZone:'America/Santiago'}) + '\n\n';
  msg += '📊 *¿En qué categoría clasificás este gasto?*\n\n';
  categories.forEach(function(cat, i) { msg += '*' + (i+1) + '.* ' + cat.emoji + ' ' + cat.name + '\n'; });
  msg += '\n_Respondé con el número (1-' + categories.length + ')_';
  msg += '\n\n🔑 _ID: ' + expenseId + '_';
  const result = await client.messages.create({ body: msg, from: FROM, to: TO });
  console.log('WhatsApp enviado: ' + result.sid);
  return result;
}

async function handleWhatsAppReply(body, from) {
  const { initDB } = require('./database');
  const db = initDB();
  const text = (body || '').trim();

  if (text.toLowerCase() === 'resumen') {
    const exps = db.getExpenses('week');
    const total = exps.reduce(function(s,e){return s+e.amount;}, 0);
    if (!exps.length) return sendReply('📊 No tenés gastos esta semana.');
    const cats = db.getCategories();
    const byCategory = {};
    exps.forEach(function(e) {
      const cat = cats.find(function(c){return c.id===e.category_id;});
      const key = e.category_id || 0;
      if (!byCategory[key]) byCategory[key] = {name:cat?cat.name:'Sin clasificar', emoji:cat?cat.emoji:'?', total:0};
      byCategory[key].total += e.amount;
    });
    let msg = '📊 *Resumen Semanal GastoFlow*\n━━━━━━━━━━━━━━━━━━━\n\n';
    msg += '💰 *Total: $' + total.toLocaleString('es-CL') + '*\n';
    msg += '🧾 ' + exps.length + ' transacciones\n\n';
    Object.values(byCategory).sort(function(a,b){return b.total-a.total;}).forEach(function(d) {
      var pct = Math.round(d.total/total*100);
      var bars = Math.round(pct/10);
      msg += d.emoji + ' *' + d.name + '*\n';
      msg += '▓'.repeat(bars) + '░'.repeat(10-bars) + ' ' + pct + '% — $' + d.total.toLocaleString('es-CL') + '\n\n';
    });
    return sendReply(msg);
  }

  var num = parseInt(text);
  if (!isNaN(num)) {
    var categories = db.getCategories();
    if (num < 1 || num > categories.length) return sendReply('⚠️ Número inválido. Elegí entre 1 y ' + categories.length);
    var category = categories[num - 1];
    var expense = db.getLastPending();
    if (!expense) return sendReply('ℹ️ No hay gastos pendientes de clasificar.');
    db.updateExpense(expense.id, { category_id: category.id, status: 'classified', classified_at: new Date().toISOString() });
    var amt = '$' + expense.amount.toLocaleString('es-CL');
    return sendReply('✅ *¡Clasificado!*\n\n' + category.emoji + ' *' + category.name + '*\n🏪 ' + expense.merchant + ' — ' + amt + '\n\n_Escribí "resumen" para ver tus estadísticas._');
  }

  return sendReply('🤔 No entendí. Respondé con un *número* para clasificar o escribí *"resumen"*.');
}

async function sendReply(message) {
  var result = await client.messages.create({ body: message, from: FROM, to: TO });
  console.log('Respuesta enviada: ' + result.sid);
  return result;
}

module.exports = { sendWhatsAppPoll, handleWhatsAppReply, sendReply };
