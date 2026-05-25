/**
 * Флаги фич. При выпуске приложения в прод — снять флаги «ожидания прода».
 *
 * VITE_WAITING_FOR_PRODUCTION=true — закрытый тест, авторизация через Steam скрыта.
 * При выходе в прод: выставить false или убрать переменную, чтобы включить Steam.
 */
export const isSteamAuthEnabled = import.meta.env.VITE_WAITING_FOR_PRODUCTION !== 'true';
