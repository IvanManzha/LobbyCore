// public/solo.js

// кеш-функция здесь
/**
 * Клиентский кэш с localStorage
 * @param {string} url — URL для fetch
 * @param {string} cacheKey — ключ в localStorage
 * @param {number}  ttl — время жизни кеша (мс)
 */
async function fetchWithCache(url, cacheKey, ttl = 60_000) {
    const now   = Date.now();
    const tsKey = cacheKey + ':ts';
    const last  = Number(localStorage.getItem(tsKey) || 0);
  
    if (now - last < ttl) {
      const str = localStorage.getItem(cacheKey);
      if (str) {
        return JSON.parse(str);
      }
    }
  
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ошибка ${res.status} при запросе ${url}`);
    const data = await res.json();
  
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(tsKey, now);
    return data;
  }

if ('EventSource' in window) {
const es = new EventSource('/api/stream');
es.addEventListener('table-updated', e => {
    const tid = e.data;
    // инвалидируем кеш конкретного турнира и активного
    localStorage.removeItem(`table:${tid}`);
    localStorage.removeItem(`table:${tid}:ts`);
    localStorage.removeItem('activeTable');
    localStorage.removeItem('activeTable:ts');

    // и сразу перерисовываем текущее view, если функция доступна
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof loadTable      === 'function') loadTable();
    if (typeof loadSoloProfile === 'function') loadSoloProfile();
    if (typeof loadPlayerProfile === 'function') loadPlayerProfile();
});
}
  
  
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupProfileButton();
    loadSoloProfile().catch(err => {
      document.body.innerHTML = `<p style="color:red; padding:2rem;">Ошибка: ${err.message}</p>`;
    });
    renderActiveButton();
    setupScheduleButton();
  });
  
  async function loadSoloProfile() {
    const params = new URLSearchParams(window.location.search);
    const player = params.get('player');
    const tid = params.get('tournament');
    if (!player) throw new Error('Ник не задан');
  
    const url = tid
      ? `/api/tournaments/${encodeURIComponent(tid)}/table`
      : '/api/table';
    const cacheKey = tid ? `table:${tid}` : 'activeTable';
  
    const json = await fetchWithCache(url, cacheKey, 60_000);
  
    const entry = json.teams.find(t => t.name === player);
    if (!entry) throw new Error(`Игрок "${player}" не найден`);
  
    const nameLink = document.getElementById('player-name-link');
    nameLink.textContent = entry.name;
    nameLink.href = `player.html?player=${encodeURIComponent(entry.name)}`;
  
    // рендерим таблицу раундов
    const tbody = document.getElementById('solo-body');
    tbody.innerHTML = '';
    entry.results.forEach((r, idx) => {
      const pp = json.tournament.scoring.per_kill || 0;
      const placementPts = json.tournament.scoring.placement[r.placement] || 0;
      const killPts = (r.kills||0)*pp;
      const totalPts = placementPts + killPts;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${r.placement!=null?r.placement:'–'}</td>
        <td>${r.kills!=null?r.kills:'–'}</td>
        <td>${totalPts}</td>
      `;
      tbody.append(tr);
    });
  }
  
  // setupThemeToggle, setupProfileButton…
  async function renderActiveButton() {
    try {
      const res = await fetch('/api/tournaments');
      if (!res.ok) return;
      const tours = await res.json();
  
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayTournament = tours.find(t => {
        const tDate = new Date(t.date).toISOString().split('T')[0];
        return tDate === todayStr || t.state === 'В процессе';
      });

      const btn = document.getElementById('active-tournament-btn');
      if (!todayTournament || !btn) return;
  
      const params = new URLSearchParams(window.location.search);
      const currentTid = params.get('tournament');
  
      const isAtCurrent = (
        window.location.pathname.endsWith('index.html') &&
        (currentTid === null || currentTid === todayTournament.id)
      );
  
      if (isAtCurrent) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.onclick = () => {
          window.location.href = `index.html?tournament=${encodeURIComponent(todayTournament.id)}`;
        };
      }
    } catch (err) {
      console.warn('Ошибка renderActiveButton:', err);
    }
  }
  
  
  
  function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-theme');
      btn.textContent = '☀️ Тема';
    }
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      btn.textContent = isDark ? '☀️ Тема' : '🌙 Тема';
    });
  }
  
  function setupProfileButton() {
    const btn = document.getElementById('profile-btn');
    if (!btn) return;
    const raw = localStorage.getItem('profile');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.name) {
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
          window.location.href = `player.html?player=${encodeURIComponent(p.name)}`;
        });
      }
    } catch {}
  }

  function setupScheduleButton() {
    const btn = document.getElementById('schedule-btn');
    if (!btn) return;
    btn.style.display = 'block';  // на случай, если где-то скрыта
    btn.addEventListener('click', () => {
      window.location.href = 'schedule.html';
    });
  }
  
  