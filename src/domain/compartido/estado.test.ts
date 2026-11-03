/**
 * Pruebas del estado de los registros (vigente o anulada).
 *
 * Qué hace: verifica que se reconozca si un registro está vigente y que se
 * rechace un estado desconocido.
 * Cómo lo hace: prueba registros de ejemplo con cada estado.
 * Por qué: nada se borra; ventas, compras, deudas y abonos se anulan con su
 * estado, y todos los cálculos deben ignorar lo anulado.
 */
import { describe, it, expect } from 'vitest'
import { estaVigente, type EstadoRegistro } from './estado'

describe('estaVigente', () => {
  it('un registro vigente está vigente', () => {
    expect(estaVigente({ estado: 'vigente' }, 'La compra c1')).toBe(true)
  })

  it('un registro anulado no está vigente', () => {
    expect(estaVigente({ estado: 'anulada' }, 'La compra c1')).toBe(false)
  })

  it('rechaza un estado desconocido y nombra el registro', () => {
    expect(() => estaVigente({ estado: 'borrada' as EstadoRegistro }, 'La compra c1')).toThrow(
      'La compra c1 tiene un estado desconocido',
    )
  })
})
