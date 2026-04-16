const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '../../data/db.json');
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) {}
  const initial = {
    categories: [
      { id:1, name:"Alimentacion", emoji:"🍔", color:"#00e5a0", sort_order:1 },
      { id:2, name:"Transporte", emoji:"🚗", color:"#4d9fff", sort_order:2 },
      { id:3, name:"Entretenimiento", emoji:"🎬", color:"#ff9f43", sort_order:3 },
      { id:4, name:"Salud", emoji:"💊", color:"#a855f7", sort_order:4 },
      { id:5, name:"Hogar", emoji:"🏠", color:"#f472b6", sort_order:5 },
      { id:6, name:"Ropa", emoji:"👗", color:"#facc15", sort_order:6 },
      { id:7, name:"Educacion", emoji:"📚", color:"#22d3ee", sort_order:7 },
      { id:8, name:"Otros", emoji:"📦", color:"#ff4d6a", sort_order:8 }
    ],
    expenses: [], nextId: 1
  };
  saveDB(initial);
  return initial;
}
function saveDB(data) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function initDB() {
  const data = loadDB();
  return {
    getCategories: () => data.categories.sort((a,b) => a.sort_order - b.sort_order),
    addExpense: (exp) => { exp.id = data.nextId++; exp.created_at = new Date().toISOString(); data.expenses.unshift(exp); saveDB(data); return exp; },
    getExpenses: (filter) => { let list = data.expenses; if (filter==='week') { const c=Date.now()-7*86400000; list=list.filter(e=>new Date(e.created_at).getTime()>c); } else if (filter==='month') { const c=Date.now()-30*86400000; list=list.filter(e=>new Date(e.created_at).getTime()>c); } return list; },
    getExpense: (id) => data.expenses.find(e => e.id === id),
    updateExpense: (id, updates) => { const exp=data.expenses.find(e=>e.id===id); if(exp){Object.assign(exp,updates);saveDB(data);} return exp; },
    deleteExpense: (id) => { data.expenses=data.expenses.filter(e=>e.id!==id); saveDB(data); },
    getLastPending: () => data.expenses.find(e => e.status === 'pending'),
    addCategory: (cat) => { cat.id=Math.max(...data.categories.map(c=>c.id),0)+1; cat.sort_order=data.categories.length+1; data.categories.push(cat); saveDB(data); return cat; },
    deleteCategory: (id) => { const o=data.categories.find(c=>c.name==='Otros'); if(o) data.expenses.forEach(e=>{if(e.category_id===id)e.category_id=o.id;}); data.categories=data.categories.filter(c=>c.id!==id); saveDB(data); },
    getStats: (filter) => { const db2=initDB(); const exps=db2.getExpenses(filter); const total=exps.reduce((s,e)=>s+e.amount,0); const count=exps.length; const byCategory={}; exps.forEach(e=>{ const cat=data.categories.find(c=>c.id===e.category_id); const key=e.category_id||0; if(!byCategory[key])byCategory[key]={id:key,name:cat?.name||'Sin clasificar',emoji:cat?.emoji||'?',color:cat?.color||'#888',total:0,count:0}; byCategory[key].total+=e.amount; byCategory[key].count++; }); const byDay={}; exps.forEach(e=>{ const day=e.created_at.split('T')[0]; if(!byDay[day])byDay[day]={day,total:0,count:0}; byDay[day].total+=e.amount; byDay[day].count++; }); return { total, count, average:count?Math.round(total/count):0, byCategory:Object.values(byCategory).sort((a,b)=>b.total-a.total), byDay:Object.values(byDay).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,7) }; }
  };
}
module.exports = { initDB };
