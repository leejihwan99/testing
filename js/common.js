/* ===========================
   공통 JS
=========================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzdgMvLS6wsEDY95sV52nEpf8gDH8jupPVENuq-9BSe4EXErXauOls9UMz98WGTd9I7/exec";

// HTML 이스케이프
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 하위 호환 별칭
const escapeHtml = escHtml;

// 토스트 메시지
function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove("show"), 2500);
}

// 날짜 포맷
function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val).split("T")[0];
}

// 한국어 날짜 포맷 (2026년 3월 19일)
function formatDateKo(val) {
  if (!val) return "";
  let str;
  if (val instanceof Date) {
    str = val.toISOString().split("T")[0];
  } else {
    str = String(val).split("T")[0];
    // "Wed Mar 18 2026 00:00:00 GMT..." 형태 처리
    if (str.includes(" ")) {
      const d = new Date(val);
      if (!isNaN(d)) str = d.toISOString().split("T")[0];
    }
  }
  const [year, month, day] = str.split("-");
  if (!year || !month || !day) return str;
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

// 새로고침 버튼 로딩 상태
function setRefreshLoading(loading) {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;
  btn.classList.toggle("loading", loading);
}

// API GET 요청
async function apiGet(params) {
  const url = API_URL + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

// API POST 요청
async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

// 마지막 업데이트 시간 표시
function setLastUpdated() {
  const el = document.getElementById("last-updated");
  if (el)
    el.textContent = "마지막 업데이트: " + new Date().toLocaleString("ko-KR");
}

// ESC 키 이벤트 등록
function registerEscKey(...closeFns) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFns.forEach((fn) => fn());
  });
}
