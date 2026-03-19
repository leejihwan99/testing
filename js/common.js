/* ===========================
   공통 JS - Supabase 연동
=========================== */

const SB_URL = 'https://fzmudqtntsblyvabnqmt.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bXVkcXRudHNibHl2YWJucW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODU1NDMsImV4cCI6MjA4OTQ2MTU0M30._e_heznn0RxcW7eAwSgN_E0tBW7UrnEAKk3ZM2V1NLE';

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

async function sbGet(table, query = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`GET ${table} 실패: ${res.status}`);
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`PATCH ${table} 실패: ${res.status}`);
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${table} 실패: ${res.status}`);
  return res.json();
}

async function sbUpsert(table, body, onConflict) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`UPSERT ${table} 실패: ${res.status}`);
  return res.json();
}

async function sbDelete(table, query) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: SB_HEADERS
  });
  if (!res.ok) throw new Error(`DELETE ${table} 실패: ${res.status}`);
  return true;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const escapeHtml = escHtml;

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 2500);
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

function formatDateKo(val) {
  if (!val) return '';
  let str;
  if (val instanceof Date) {
    str = val.toISOString().split('T')[0];
  } else {
    str = String(val).split('T')[0];
    if (str.includes(' ')) {
      const d = new Date(val);
      if (!isNaN(d)) str = d.toISOString().split('T')[0];
    }
  }
  const [year, month, day] = str.split('-');
  if (!year || !month || !day) return str;
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}
