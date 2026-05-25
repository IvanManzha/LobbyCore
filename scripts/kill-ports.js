#!/usr/bin/env node
// Скрипт для убийства процессов на указанных портах

const { execSync } = require('child_process');
const os = require('os');

const ports = [3100, 5173, 5174]; // Порты бэкенда и фронтенда

function killPort(port) {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = result.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      });
      
      pids.forEach(pid => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`✅ Убит процесс ${pid} на порту ${port}`);
        } catch (err) {
          // Процесс уже завершен или нет прав
        }
      });
    } else {
      // macOS и Linux
      try {
        // Находим PID процесса на порту
        const result = execSync(`lsof -ti :${port}`, { encoding: 'utf-8', stdio: 'pipe' });
        const pids = result.trim().split('\n').filter(Boolean);
        
        pids.forEach(pid => {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`✅ Убит процесс ${pid} на порту ${port}`);
          } catch (err) {
            // Процесс уже завершен
          }
        });
      } catch (err) {
        // Порт свободен, ничего не делаем
        console.log(`ℹ️  Порт ${port} свободен`);
      }
    }
  } catch (err) {
    // Порт свободен или ошибка
    console.log(`ℹ️  Порт ${port} свободен или ошибка: ${err.message}`);
  }
}

console.log('🧹 Очистка портов перед запуском...\n');

ports.forEach(port => {
  killPort(port);
});

console.log('\n✅ Очистка завершена\n');
