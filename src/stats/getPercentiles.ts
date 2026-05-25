/**
 * Вычисляет перцентиль для значения игрока относительно массива значений
 * Используется на клиенте для обработки данных с API
 */

export const calculatePercentileFromValues = (
  playerValue: number | null,
  allValues: number[],
  invert: boolean = false
): number | null => {
  if (playerValue == null || !Number.isFinite(playerValue)) {
    return null;
  }

  if (allValues.length === 0) {
    return null;
  }

  // Фильтруем валидные значения
  const validValues = allValues.filter((v) => v != null && Number.isFinite(v));

  if (validValues.length === 0) {
    return null;
  }

  // Сортируем значения
  const sorted = [...validValues].sort((a, b) => {
    if (invert) {
      return a - b; // Для avg_place: меньше = лучше
    }
    return b - a; // Для остальных: больше = лучше
  });

  // Находим позицию текущего значения
  let rank = -1;
  if (invert) {
    // Для avg_place: ищем первое значение >= playerValue (меньше или равно = лучше)
    rank = sorted.findIndex((v) => v >= playerValue);
  } else {
    // Для остальных: ищем первое значение <= playerValue (больше или равно = лучше)
    rank = sorted.findIndex((v) => v <= playerValue);
  }

  // Если не нашли (значение лучше всех), перцентиль = 100
  if (rank === -1) {
    return 100;
  }

  // Вычисляем перцентиль
  const percentile = (rank / sorted.length) * 100;

  // Для avg_place инвертируем результат
  if (invert) {
    return Math.round(100 - percentile);
  }

  return Math.round(percentile);
};
