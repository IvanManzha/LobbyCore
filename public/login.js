// public/login.js

document.addEventListener('DOMContentLoaded', () => {
    const form     = document.getElementById('login-form');
    const pubgInput = document.getElementById('pubgId');
    const guestBtn = document.getElementById('guest-btn');
    const registerBtn = document.getElementById('register-btn');
  
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pubgId = pubgInput.value.trim();
      if (!pubgId) return alert('Введите ваш PUBG-ник');
  
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubgId })
        });
        if (!res.ok) {
          const error = await res.json();
          return alert(error.error || 'Ошибка входа');
        }
        const { profile } = await res.json();
        localStorage.setItem('profile', JSON.stringify(profile));
        window.location.href = `player.html?player=${encodeURIComponent(profile.name)}`;
      } catch (err) {
        console.error(err);
        alert('Сетевая ошибка');
      }
    });
  
    guestBtn.addEventListener('click', () => {
      localStorage.removeItem('profile');
      window.location.href = 'index.html?guest=true';
    });

    registerBtn.addEventListener('click', async () => {
      const pubgId = pubgInput.value.trim();
      if (!pubgId) return alert('Введите ваш PUBG-ник для регистрации');
  
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubgId })
        });
        if (!res.ok) {
          const err = await res.json();
          return alert(err.error || 'Не удалось зарегистрировать игрока');
        }
        alert(`Игрок ${pubgId} зарегистрирован успешно! Теперь можно войти.`);
      } catch (e) {
        console.error(e);
        alert('Сетевая ошибка при регистрации');
      }
    });
    
  });
  