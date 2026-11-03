/**
 * Pruebas de la detección de cierres desactualizados.
 *
 * Qué hace: verifica que, a partir de la bitácora, se decida qué cierres
 * quedaron desactualizados.
 * Cómo lo hace: repositorios falsos con un cierre semanal calculado y
 * entradas de bitácora anteriores y posteriores al cálculo.
 * Por qué: un cierre guarda cuándo se calculó; si después cambia algo que
 * usó, hay que avisar al usuario para que lo recalcule (nunca es automático).
 */
import { describe, it, expect } from 'vitest'
import { crearDetectorDesactualizados } from './cierresDesactualizados'
import type { CierreLeido } from '../datos/cierres'
import type { EntradaBitacora } from '../datos/bitacora'

const cierre: CierreLeido = {
  id: 'c1',
  tipo: 'semanal',
  desde: '2026-11-02',
  hasta: '2026-11-08',
  calculadoEn: '2026-11-09T12:00:00.000Z',
  efectivo: 1,
  transferencias: 1,
  dineroCorregidoEn: null,
  costosManuales: {},
  costosUsados: [{ productoId: 'p1', compra: { id: 'compra-usada', fecha: '2026-11-01' } }],
  resultado: {},
}

let n = 0
const entrada = (e: Partial<EntradaBitacora> & Pick<EntradaBitacora, 'accion' | 'momento'>): EntradaBitacora => ({
  id: `b${++n}`,
  usuario: 'persona@ejemplo.com',
  tabla: null,
  registroId: null,
  antes: null,
  despues: {},
  motivo: null,
  ...e,
})

async function desactualizados(entradas: EntradaBitacora[], cierres: CierreLeido[] = [cierre]) {
  const detector = crearDetectorDesactualizados({
    cierres: { listarCierres: async () => cierres },
    bitacora: { listarBitacora: async () => entradas },
  })
  return detector.idsDesactualizados()
}

describe('idsDesactualizados', () => {
  it('sin cambios, el cierre está al día', async () => {
    expect(await desactualizados([])).toEqual([])
  })

  it('una venta del periodo anulada después del cálculo lo desactualiza', async () => {
    const anulacion = entrada({ accion: 'anular-registro', momento: '2026-11-10T08:00:00.000Z', tabla: 'ventas', registroId: 'v1', despues: { fecha: '2026-11-03', estado: 'anulada' }, motivo: 'error' })
    expect(await desactualizados([anulacion])).toEqual(['c1'])
  })

  it('una anulación anterior al cálculo o de otro periodo no lo desactualiza', async () => {
    const antes = entrada({ accion: 'anular-registro', momento: '2026-11-09T11:00:00.000Z', tabla: 'ventas', registroId: 'v1', despues: { fecha: '2026-11-03' }, motivo: 'x' })
    const otraSemana = entrada({ accion: 'anular-registro', momento: '2026-11-10T08:00:00.000Z', tabla: 'ventas', registroId: 'v2', despues: { fecha: '2026-10-20' }, motivo: 'x' })
    expect(await desactualizados([antes, otraSemana])).toEqual([])
  })

  it('una venta, deuda o abono nuevos con fecha del periodo, registrados después, lo desactualizan', async () => {
    for (const [accion, tabla] of [['registrar-venta', 'ventas'], ['registrar-deuda', 'deudas'], ['registrar-abono', 'abonos_deuda']] as const) {
      const nuevo = entrada({ accion, momento: '2026-11-10T08:00:00.000Z', tabla, registroId: 'x', despues: { fecha: '2026-11-04' } })
      expect(await desactualizados([nuevo])).toEqual(['c1'])
    }
  })

  it('corregir o anular la compra que usó el cierre lo desactualiza; otra compra no', async () => {
    const corregir = (id: string) => entrada({ accion: 'corregir-costo-compra', momento: '2026-11-10T08:00:00.000Z', tabla: 'compras', registroId: id, despues: { fecha: '2026-11-01', producto_id: 'p1' } })
    expect(await desactualizados([corregir('compra-usada')])).toEqual(['c1'])
    expect(await desactualizados([corregir('otra')])).toEqual([])
    const anular = entrada({ accion: 'anular-registro', momento: '2026-11-10T08:00:00.000Z', tabla: 'compras', registroId: 'compra-usada', despues: { fecha: '2026-11-01', producto_id: 'p1' }, motivo: 'x' })
    expect(await desactualizados([anular])).toEqual(['c1'])
  })

  it('una compra nueva solo lo desactualiza si podría cambiar el costo usado', async () => {
    const nueva = (fecha: string, producto: string) => entrada({ accion: 'registrar-compra', momento: '2026-11-10T08:00:00.000Z', tabla: 'compras', registroId: 'n', despues: { fecha, producto_id: producto } })
    expect(await desactualizados([nueva('2026-11-05', 'p1')])).toEqual(['c1'])
    expect(await desactualizados([nueva('2026-10-20', 'p1')])).toEqual([])
    expect(await desactualizados([nueva('2026-11-05', 'p2')])).toEqual([])
  })

  it('corregir el dinero del cierre lo desactualiza hasta recalcular', async () => {
    const corregido = { ...cierre, dineroCorregidoEn: '2026-11-10T09:00:00.000Z' }
    expect(await desactualizados([], [corregido])).toEqual(['c1'])
  })

  it('ignora las acciones que no afectan cierres', async () => {
    const traslado = entrada({ accion: 'registrar-traslado', momento: '2026-11-10T08:00:00.000Z', tabla: 'movimientos_inventario', despues: { unidades: 3 } })
    expect(await desactualizados([traslado])).toEqual([])
  })

  it('falla si una entrada relevante no trae fecha', async () => {
    const mala = entrada({ accion: 'registrar-venta', momento: '2026-11-10T08:00:00.000Z', tabla: 'ventas', registroId: 'v', despues: {} })
    await expect(desactualizados([mala])).rejects.toThrow(/fecha/i)
  })
})
