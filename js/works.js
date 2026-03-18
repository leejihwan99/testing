let allWorks = [];
  let sortKey = 'title';
  let sortAsc = true;
  let editingRowIndex = null;
  let deletingRowIndex = null;

  // 데이터 로드
  async function loadData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');
    try {
      const res = await fetch(`${API_URL}?action=getWorks`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      allWorks = data;
      renderTable();
      const now = new Date().toLocaleString('ko-KR');
      document.getElementById('last-updated').textContent = `마지막 업데이트: ${now}`;
    } catch (e) {
      showToast('데이터 로드 실패: ' + e.message, 'error');
      document.getElementById('table-body').innerHTML =
        `<tr class="empty-row"><td colspan="5">데이터를 불러올 수 없습니다.</td></tr>`;
    } finally {
      btn.classList.remove('loading');
    }
  }

  // 정렬
  let currentSortEl = null;
  function sortBy(key, el) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    if (currentSortEl) currentSortEl.classList.remove('sorted');
    el.classList.add('sorted');
    currentSortEl = el;
    renderTable();
  }

  // 테이블 렌더링
  function renderTable() {
    const search = document.getElementById('search-input').value.trim().toLowerCase();

    let filtered = allWorks.filter(w =>
      !search ||
      w.title.toLowerCase().includes(search) ||
      w.engTitle.toLowerCase().includes(search) ||
      w.author.toLowerCase().includes(search)
    );

    filtered.sort((a, b) => {
      const va = a[sortKey]?.toLowerCase() || '';
      const vb = b[sortKey]?.toLowerCase() || '';
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    document.getElementById('count-text').textContent =
      search ? `${filtered.length} / ${allWorks.length}개` : `총 ${allWorks.length}개`;

    const tbody = document.getElementById('table-body');

    if (!filtered.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">조건에 맞는 작품이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(w => `
      <tr>
        <td>
          <a class="work-title-link" href="${escapeHtml(w.url)}" target="_blank" rel="noopener">${escapeHtml(w.title)}</a>
        </td>
        <td>${escapeHtml(w.engTitle)}</td>
        <td class="author-text">${escapeHtml(w.author)}</td>
        <td><a class="url-link" href="${escapeHtml(w.url)}" target="_blank" rel="noopener" title="${escapeHtml(w.url)}">${escapeHtml(w.url)}</a></td>
        <td>
          <div class="action-btns">
            <button class="btn-edit" onclick="openEditModal(${w.rowIndex})" title="수정">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-delete" onclick="openDeleteModal(${w.rowIndex}, '${escapeHtml(w.title)}', '${escapeHtml(w.engTitle)}')" title="삭제">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // 추가 모달
  function openAddModal() {
    editingRowIndex = null;
    document.getElementById('form-modal-title').textContent = '작품 추가';
    document.getElementById('input-title').value = '';
    document.getElementById('input-eng-title').value = '';
    document.getElementById('input-url').value = '';
    document.getElementById('input-author').value = '';
    clearFormErrors();
    document.getElementById('form-modal').classList.add('open');
    setTimeout(() => document.getElementById('input-title').focus(), 100);
  }

  // 수정 모달
  function openEditModal(rowIndex) {
    const work = allWorks.find(w => w.rowIndex === rowIndex);
    if (!work) return;
    editingRowIndex = rowIndex;
    document.getElementById('form-modal-title').textContent = '작품 수정';
    document.getElementById('input-title').value = work.title;
    document.getElementById('input-eng-title').value = work.engTitle;
    document.getElementById('input-url').value = work.url;
    document.getElementById('input-author').value = work.author;
    clearFormErrors();
    document.getElementById('form-modal').classList.add('open');
    setTimeout(() => document.getElementById('input-title').focus(), 100);
  }

  function closeFormModal(e) {
    if (e.target === document.getElementById('form-modal')) closeFormModalDirect();
  }

  function closeFormModalDirect() {
    document.getElementById('form-modal').classList.remove('open');
    editingRowIndex = null;
  }

  function clearFormErrors() {
    ['title','eng-title','url','author','global'].forEach(id => {
      const el = document.getElementById(`error-${id}`);
      if (el) { el.textContent = ''; el.classList.remove('show'); }
    });
    ['input-title','input-eng-title','input-url','input-author'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });
  }

  // 폼 제출
  async function submitForm() {
    clearFormErrors();
    const title = document.getElementById('input-title').value.trim();
    const engTitle = document.getElementById('input-eng-title').value.trim();
    const url = document.getElementById('input-url').value.trim();
    const author = document.getElementById('input-author').value.trim();

    let hasError = false;
    if (!title) { showFieldError('title', '작품명을 입력하세요.'); hasError = true; }
    if (!engTitle) { showFieldError('eng-title', '영문명을 입력하세요.'); hasError = true; }
    if (!url) { showFieldError('url', 'URL을 입력하세요.'); hasError = true; }
    if (!author) { showFieldError('author', '작가명을 입력하세요.'); hasError = true; }
    if (hasError) return;

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
      const body = editingRowIndex
        ? { action: 'updateWork', rowIndex: editingRowIndex, title, engTitle, url, author }
        : { action: 'addWork', title, engTitle, url, author };

      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();

      if (!data.success) {
        const errEl = document.getElementById('error-global');
        errEl.textContent = data.error || '저장에 실패했습니다.';
        errEl.classList.add('show');
        return;
      }

      closeFormModalDirect();
      showToast(editingRowIndex ? '수정 완료' : '추가 완료', 'success');
      await loadData();
    } catch {
      const errEl = document.getElementById('error-global');
      errEl.textContent = '서버 오류가 발생했습니다.';
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = '저장';
    }
  }

  function showFieldError(id, msg) {
    const input = document.getElementById(`input-${id}`);
    const err = document.getElementById(`error-${id}`);
    if (input) input.classList.add('error');
    if (err) { err.textContent = msg; err.classList.add('show'); }
  }

  // 삭제 모달
  function openDeleteModal(rowIndex, title, engTitle) {
    deletingRowIndex = rowIndex;
    document.getElementById('delete-desc').innerHTML =
      `<strong>${title}</strong> (${engTitle})<br>삭제하면 되돌릴 수 없습니다.`;
    document.getElementById('delete-modal').classList.add('open');
  }

  function closeDeleteModal(e) {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModalDirect();
  }

  function closeDeleteModalDirect() {
    document.getElementById('delete-modal').classList.remove('open');
    deletingRowIndex = null;
  }

  async function confirmDelete() {
    if (!deletingRowIndex) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteWork', rowIndex: deletingRowIndex })
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      closeDeleteModalDirect();
      showToast('삭제 완료', 'success');
      await loadData();
    } catch {
      showToast('삭제 실패', 'error');
    }
  }

  // 유틸
  
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeFormModalDirect();
      closeDeleteModalDirect();
    }
    if (e.key === 'Enter' && document.getElementById('form-modal').classList.contains('open')) {
      submitForm();
    }
  });

  loadData();