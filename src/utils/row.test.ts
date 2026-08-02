import { describe, expect, it } from 'vitest';
import { asBoolean, asNumber, asOptionalString, asString, compositeId } from './row';

describe('row utilities', () => {
  it('convierte valores dinámicos del backend a tipos seguros para la UI', () => {
    expect(asNumber('12')).toBe(12);
    expect(asNumber('no-numérico', 7)).toBe(7);
    expect(asString('Alumno')).toBe('Alumno');
    expect(asString(null, 'fallback')).toBe('fallback');
    expect(asOptionalString('  correo@demo.test  ')).toBe('  correo@demo.test  ');
    expect(asOptionalString('')).toBeNull();
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean('true', false)).toBe(false);
  });

  it('genera ids compuestos con el mismo formato que espera el backend genérico', () => {
    const row = { id_alumno: 12, id_forma: 4, fecha_aprendida: '2026-08-02' };

    expect(compositeId(row, ['id_alumno', 'id_forma'])).toBe('12,4');
  });
});
