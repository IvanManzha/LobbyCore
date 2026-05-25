// public/team.js

/**
 * Клиентский кэш с localStorage
 * @param {string} url — URL запроса
 * @param {string} cacheKey — ключ в localStorage
 * @param {number} ttl — время жизни кеша в мс
 */
async function fetchWithCache(url, cacheKey, ttl = 60_000) {
  const now = Date.now();
  const tsKey = cacheKey + ':ts';
  const last = Number(localStorage.getItem(tsKey) || 0);

  if (now - last < ttl) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
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


if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
}

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupProfileButton();
  setupScheduleButton();
  loadTeam().catch(err => {
    console.error(err);
    document.body.innerHTML = `<p style="color:red; padding:2rem;">Ошибка: ${err.message}</p>`;
  });
  renderActiveButton();
});

async function loadTeam() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('team');
  const tid  = params.get('tournament');
  if (!name) throw new Error('Параметр team не задан');

  // Настраиваем ссылку «Назад»
  const backLink = document.getElementById('back-link');
  if (backLink) {
    backLink.href = tid
      ? `index.html?tournament=${encodeURIComponent(tid)}`
      : 'index.html';
  }

  // Определяем URL для таблицы и cacheKey
  const url = tid
    ? `/api/tournaments/${encodeURIComponent(tid)}/table`
    : '/api/table';
  const cacheKey = tid ? `table:${tid}` : 'activeTable';

  // Загружаем данные с кешем
  const json = await fetchWithCache(url, cacheKey, 60_000);

  // Отображаем название турнира
  const tournNameEl = document.getElementById('tournament-name');
  if (tournNameEl) {
    tournNameEl.textContent = json.tournament?.name || 'Без названия турнира';
  }

  // Находим и отображаем команду
  const team = json.teams.find(t => t.name === name);
  if (!team) throw new Error(`Команда "${name}" не найдена`);

  document.getElementById('team-name').textContent = team.name;
  document.getElementById('team-composition').textContent =
    'Состав: ' + ((team.players || []).join(', ') || '—');

  // Позиции по матчам
  const headerRow = document.getElementById('positions-header');
  headerRow.innerHTML = '';
  for (let i = 1; i <= json.tournament.rounds; i++) {
    headerRow.insertAdjacentHTML('beforeend', `<th>Матч ${i}</th>`);
  }
  const posRow = document.getElementById('positions-row');
  posRow.innerHTML = '';
  team.results.forEach(r => {
    posRow.insertAdjacentHTML('beforeend',
      `<td>${r.placement != null ? r.placement : '–'}</td>`);
  });

  // Киллы по игрокам
  const killsHeader = document.getElementById('kills-header');
  // очищаем старые
  Array.from(killsHeader.querySelectorAll('th')).slice(1).forEach(n => n.remove());
  for (let i = 1; i <= json.tournament.rounds; i++) {
    killsHeader.insertAdjacentHTML('beforeend', `<th>Раунд ${i}</th>`);
  }
  const killsBody = document.getElementById('kills-body');
  killsBody.innerHTML = '';
  (team.players || []).forEach((player, idx) => {
    const killsArr = team.playerKills[idx]?.kills || [];
    const link = `<a href="player.html?player=${encodeURIComponent(player)}">${player}</a>`;
    let rowHtml = `<tr><td>${link}</td>`;
    for (let i = 0; i < json.tournament.rounds; i++) {
      rowHtml += `<td>${killsArr[i] != null ? killsArr[i] : '–'}</td>`;
    }
    rowHtml += '</tr>';
    killsBody.insertAdjacentHTML('beforeend', rowHtml);
  });
}
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
    const dark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    btn.textContent = dark ? '☀️ Тема' : '🌙 Тема';
  });
}

function setupProfileButton() {
  const btn = document.getElementById('profile-btn');
  if (!btn) return;
  btn.style.display = 'none';
  try {
    const p = JSON.parse(localStorage.getItem('profile') || '{}');
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
  btn.style.display = 'block';
  btn.addEventListener('click', () => {
    window.location.href = 'schedule.html';
  });
}
