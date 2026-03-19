let allData = [];
let currentFilter = '';
let sortKey = 'totalViews';
let sortAsc = false;

async function loadData() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('loading');
  try {
    // raw_data와 members 병렬 로드
    const [rawRows, memberRows] = await Promise.all([
      sbGet('raw_data', '?select=member_id,views,date&order=date.desc'),
      sbGet('members', '?select=*')
    ]);

    // members 맵
    const memberMap = {};
    for (const m of memberRows) {
      memberMap[m.member_id] = m;
    }

    // raw_data 집계
    const stats = {};
    for (const r of rawRows) {
      const id = String(r.member_id);
      if (!stats[id]) stats[id] = { totalViews: 0, count: 0, lastDate: '' };
      stats[id].totalViews += Number(r.views);
      stats[id].count += 1;
      const rDate = r.date ? String(r.date).slice(0, 10) : '';
      if (rDate && (!stats[id].lastDate || rDate > stats[id].lastDate)) {
        stats[id].lastDate = rDate;
      }
    }

    allData = Object.entries(stats).map(([id, s]) => ({
      memberId: id,
      totalViews: s.totalViews,
      count: s.count,
      lastDate: s.lastDate,
      status: memberMap[id]?.status || '',
      blockedDate: memberMap[id]?.blocked_date || '',
      memo: memberMap[id]?.memo || '',
    }));

    updateStats();
    renderTable();
    document.getElementById('last-updated').textContent = '마지막 업데이트: ' + new Date().toLocaleString('ko-KR');
  } catch (e) {
    showToast('데이터 로드 실패: ' + e.message, 'error');
    document.getElementById('table-body').innerHTML =
      `<tr class="empty-row"><td colspan="7">데이터를 불러올 수 없습니다.</td></tr>`;
  } finally {
    btn.classList.remove('loading');
  }
}

function updateStats() {
  document.getElementById('stat-total').textContent = allData.length;
  document.getElementById('stat-unset').textContent = allData.filter(d => !d.status).length;
  document.getElementById('stat-exception').textContent = allData.filter(d => d.status === '예외').length;
  document.getElementById('stat-monitoring').textContent = allData.filter(d => d.status === '모니터링').length;
  document.getElementById('stat-crawling').textContent = allData.filter(d => d.status === '크롤링').length;
  document.getElementById('stat-blocked').textContent = allData.filter(d => d.status === '차단').length;
}

function setFilter(val) {
  currentFilter = val;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === val);
  });
  renderTable();
}

function sortBy(key) {
  if (sortKey === key) sortAsc = !sortAsc;
  else { sortKey = key; sortAsc = false; }
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
  event.currentTarget.classList.add('sorted');
  renderTable();
}

function renderTable() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  let filtered = allData.filter(d => {
    const matchFilter = !currentFilter ? true
      : currentFilter === '__unset__' ? !d.status
      : d.status === currentFilter;
    const matchSearch = !search || String(d.memberId).toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  filtered.sort((a, b) => {
    let va = a[sortKey] || '', vb = b[sortKey] || '';
    if (sortKey === 'totalViews' || sortKey === 'count') { va = Number(va); vb = Number(vb); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('table-body');
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">조건에 맞는 데이터가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td><span class="member-id" onclick="openLog('${d.memberId}')">${d.memberId}</span></td>
      <td><span class="num">${Number(d.totalViews).toLocaleString()}</span></td>
      <td><span class="num">${d.count}</span></td>
      <td><span class="date">${formatDate(d.lastDate)}</span></td>
      <td>
        <select class="status-select s-${d.status}" onchange="updateStatus('${d.memberId}', this)">
          <option value="" ${!d.status ? 'selected' : ''}>— 미설정</option>
          <option value="예외" ${d.status === '예외' ? 'selected' : ''}>예외</option>
          <option value="모니터링" ${d.status === '모니터링' ? 'selected' : ''}>모니터링</option>
          <option value="크롤링" ${d.status === '크롤링' ? 'selected' : ''}>크롤링</option>
          <option value="차단" ${d.status === '차단' ? 'selected' : ''}>차단</option>
        </select>
      </td>
      <td><span class="blocked-date">${d.blockedDate ? formatDate(d.blockedDate) : ''}</span></td>
      <td>
        <div class="memo-cell">
          ${d.memo ? `<span class="memo-text" title="${escHtml(d.memo)}">${escHtml(d.memo)}</span>` : ''}
          <button class="memo-btn" onclick="openMemo('${d.memberId}')" title="메모 편집">✎</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateStatus(memberId, selectEl) {
  const newStatus = selectEl.value;
  const prevStatus = selectEl.className.replace('status-select s-', '').trim();
  selectEl.disabled = true;
  try {
    const today = new Date().toISOString().split('T')[0];
    const body = {
      status: newStatus,
      blocked_date: newStatus === '차단' ? today : null,
    };
    // upsert (없으면 insert, 있으면 update)
    await sbUpsert('members', { member_id: parseInt(memberId), ...body, memo: allData.find(d => d.memberId === memberId)?.memo || '' }, 'member_id');

    const member = allData.find(d => d.memberId === memberId);
    if (member) {
      member.status = newStatus;
      member.blockedDate = newStatus === '차단' ? today : '';
    }
    selectEl.className = `status-select s-${newStatus}`;
    updateStats();
    const row = selectEl.closest('tr');
    const blockedCell = row.querySelector('.blocked-date');
    if (blockedCell) blockedCell.textContent = newStatus === '차단' ? formatDate(today) : '';
    showToast(`${memberId} 상태 변경 완료`, 'success');
  } catch (e) {
    selectEl.className = `status-select s-${prevStatus}`;
    showToast('상태 변경 실패: ' + e.message, 'error');
  } finally {
    selectEl.disabled = false;
  }
}

async function openLog(memberId) {
  document.getElementById('modal-member-id').textContent = memberId;
  document.getElementById('log-body').innerHTML =
    `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim);"><span class="spinner"></span></td></tr>`;
  document.getElementById('modal-footer').textContent = '';
  document.getElementById('modal').classList.add('open');
  try {
    const logs = await sbGet('raw_data', `?member_id=eq.${memberId}&order=date.desc`);
    if (!logs.length) {
      document.getElementById('log-body').innerHTML =
        `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim);">로그 없음</td></tr>`;
      return;
    }
    document.getElementById('log-body').innerHTML = logs.map(l => `
      <tr>
        <td>${l.member_id}</td>
        <td>${Number(l.views).toLocaleString()}</td>
        <td>${formatDate(l.date)}</td>
      </tr>
    `).join('');
    const total = logs.reduce((s, l) => s + Number(l.views), 0);
    document.getElementById('modal-footer').textContent = `총 ${logs.length}건 · 열람수 합계: ${total.toLocaleString()}`;
  } catch (e) {
    document.getElementById('log-body').innerHTML =
      `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--red);">로그 불러오기 실패</td></tr>`;
  }
}

function closeModal(e) { if (e.target === document.getElementById('modal')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('modal').classList.remove('open'); }

let memoTargetId = null;

function openMemo(memberId) {
  memoTargetId = memberId;
  const member = allData.find(d => d.memberId === memberId);
  document.getElementById('memo-modal-member-id').textContent = memberId;
  document.getElementById('memo-textarea').value = member?.memo || '';
  document.getElementById('memo-modal').classList.add('open');
  setTimeout(() => document.getElementById('memo-textarea').focus(), 100);
}

function closeMemoModal(e) { if (e.target === document.getElementById('memo-modal')) closeMemoModalDirect(); }
function closeMemoModalDirect() { document.getElementById('memo-modal').classList.remove('open'); memoTargetId = null; }

async function saveMemo() {
  const memo = document.getElementById('memo-textarea').value.trim();
  if (!memoTargetId) return;
  try {
    const member = allData.find(d => d.memberId === memoTargetId);
    await sbUpsert('members', {
      member_id: parseInt(memoTargetId),
      status: member?.status || '',
      blocked_date: member?.blockedDate || null,
      memo
    }, 'member_id');
    if (member) member.memo = memo;
    closeMemoModalDirect();
    renderTable();
    showToast('메모 저장 완료', 'success');
  } catch (e) {
    showToast('메모 저장 실패: ' + e.message, 'error');
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModalDirect(); closeMemoModalDirect(); }
});

loadData();
