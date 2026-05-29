import React from 'react';
import './ThemeToggle.css';

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="btn btn-ghost theme-toggle"
      onClick={onToggle}
      title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
    >
      Тема: {theme === 'light' ? 'Светлая' : 'Темная'}
    </button>
  );
}

export default ThemeToggle;

