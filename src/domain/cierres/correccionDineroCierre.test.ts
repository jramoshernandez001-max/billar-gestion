/**
 * Pruebas de la corrección del dinero contado de un cierre.
 *
 * Qué hace: verifica que corregir el efectivo y las transferencias de un
 * cierre deje el registro de bitácora con antes y después, y que el cierre
 * quede desactualizado hasta que un usuario lo recalcule a mano.
 * Cómo lo hace: guarda un cierre de ejemplo inventado, corrige su dinero y
 * revisa el cierre, el registro y estaDesactualizado antes y después de
 * recalcular.
 * Por qué: el dinero se cuenta a mano y puede quedar mal; corregirlo cambia
 * el cuadre, así que el resultado guardado deja de servir.
 */
import { describe, it, expect } from 'vitest'
import { estaDesactualizado, guardarCierre, recalcularCierre } from './actualizacionCierre'
import { corregirDineroCierre } from './correccionDineroCierre'

const cierre = guardarCierre({
  tipo: 'diario',
  desde: '2026-03-12',
  hasta: '2026-03-12',
  momento: new Date('2026-03-13T02:00:00.000Z'),
  efectivo: 30000,
  transferencias: 20000,
  costosUsados: [],
  resultado: { total: 1 },
})
const momento = new Date('2026-03-13T15:00:00.000Z')

describe('corregirDineroCierre', () => {
  it('cambia el efectivo y las transferencias y marca cuándo se corrigió', () => {
    const { cierre: corregido } = corregirDineroCierre({ cierre, efectivo: 32000, transferencias: 18000, usuario: 'a@example.com', momento })
    expect(corregido).toEqual({
      ...cierre,
      efectivo: 32000,
      transferencias: 18000,
      dineroCorregidoEn: '2026-03-13T15:00:00.000Z',
    })
  })

  it('no cambia el resultado ni el momento del cálculo', () => {
    const { cierre: corregido } = corregirDineroCierre({ cierre, efectivo: 32000, transferencias: 18000, usuario: 'a@example.com', momento })
    expect(corregido.resultado).toBe(cierre.resultado)
    expect(corregido.calculadoEn).toBe(cierre.calculadoEn)
  })

  it('deja el registro de bitácora con antes y después', () => {
    const { cierre: corregido, registro } = corregirDineroCierre({ cierre, efectivo: 32000, transferencias: 18000, usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-13T15:00:00.000Z',
      accion: 'corregir-dinero-cierre',
      antes: cierre,
      despues: corregido,
    })
  })

  it('el cierre corregido queda desactualizado hasta que se recalcule a mano', () => {
    expect(estaDesactualizado(cierre, [])).toBe(false)
    const { cierre: corregido } = corregirDineroCierre({ cierre, efectivo: 32000, transferencias: 18000, usuario: 'a@example.com', momento })
    expect(estaDesactualizado(corregido, [])).toBe(true)

    const { cierre: recalculado } = recalcularCierre({
      anterior: corregido,
      resultado: { total: 2 },
      costosUsados: [],
      usuario: 'a@example.com',
      momento: new Date('2026-03-13T16:00:00.000Z'),
    })
    expect(estaDesactualizado(recalculado, [])).toBe(false)
    // El recálculo conserva el dinero corregido.
    expect(recalculado.efectivo).toBe(32000)
    expect(recalculado.transferencias).toBe(18000)
  })

  it('rechaza montos negativos o con decimales', () => {
    expect(() => corregirDineroCierre({ cierre, efectivo: -1, transferencias: 0, usuario: 'a@example.com', momento })).toThrow()
    expect(() => corregirDineroCierre({ cierre, efectivo: 0, transferencias: 1.5, usuario: 'a@example.com', momento })).toThrow()
  })

  it('rechaza un momento inválido', () => {
    expect(() =>
      corregirDineroCierre({ cierre, efectivo: 1, transferencias: 1, usuario: 'a@example.com', momento: new Date('x') }),
    ).toThrow()
  })
})
