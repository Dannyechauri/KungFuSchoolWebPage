import { describe, expect, it } from 'vitest';
import { addMonths, dateKey, startOfMonth, toDateInputValue, toDateTimeInputValue } from './date';

describe('date utilities', () => {
  it('normaliza fechas para inputs HTML sin obligar a la pantalla a conocer el formato', () => {
    expect(toDateInputValue('2026-08-02T18:30:00')).toBe('2026-08-02');
    expect(toDateInputValue(null)).toBe('');
    expect(toDateTimeInputValue('2026-08-02T18:30:00')).toBe('2026-08-02T18:30');
  });

  it('calcula claves locales de calendario de forma estable', () => {
    const date = new Date(2026, 7, 2);

    expect(dateKey(date)).toBe('2026-08-02');
    expect(startOfMonth(date)).toEqual(new Date(2026, 7, 1));
    expect(addMonths(date, 1)).toEqual(new Date(2026, 8, 1));
  });
});
