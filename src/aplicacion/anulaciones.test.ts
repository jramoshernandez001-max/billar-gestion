/**
 * Pruebas de la lectura de anulaciones desde la bitácora.
 *
 * Qué hace: verifica que se tome el motivo y el día de cada anulación de una
 * tabla dada (ventas, compras, deudas, abonos) y se ignore lo demás.
 * Cómo lo hace: entradas de bitácora inventadas.
 * Por qué: la base guarda el estado, pero el motivo vive solo en la bitácora.
 */
import { describe, it, expect } from 'vitest'
import { anulacionesDe } from './anulaciones'
import type { EntradaBitacora } from '../datos/bitacora'

const entrada = (sobre: Partial<EntradaBitacora>): EntradaBitacora => ({
  id: 'b', momento: new Date(2026, 10, 3, 17, 0).toISOString(), usuario: 'ana@ejemplo.com',
  accion: 'anular-registro', tabla: 'compras', registroId: 'c1', antes: null, despues: {}, motivo: 'compra duplicada', ...sobre,
})

describe('anulacionesDe', () => {
  it('toma motivo y día local de las anulaciones de la tabla pedida', () => {
    expect(anulacionesDe([entrada({})], 'compras').get('c1')).toEqual({ motivo: 'compra duplicada', fecha: '2026-11-03' })
  })

  it('ignora otras tablas, otras acciones y entradas sin registro o motivo', () => {
    const lista = [
      entrada({ tabla: 'ventas' }),
      entrada({ accion: 'registrar-compra' }),
      entrada({ registroId: null }),
      entrada({ motivo: null }),
    ]
    expect(anulacionesDe(lista, 'compras').size).toBe(0)
  })
})
