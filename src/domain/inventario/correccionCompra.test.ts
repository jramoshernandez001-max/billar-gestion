/**
 * Pruebas de la corrección del costo de una compra.
 *
 * Qué hace: verifica que corregir el costo produzca la compra con el costo
 * nuevo y su registro de bitácora con antes y después, y que la última
 * compra de un producto refleje la corrección.
 * Cómo lo hace: arma compras de ejemplo inventadas, corrige una y revisa la
 * compra, el registro y el resultado de ultimaCompraDe.
 * Por qué: el costo se captura a mano y puede quedar mal; corregirlo no debe
 * borrar nada, y la utilidad debe usar el costo correcto.
 */
import { describe, it, expect } from 'vitest'
import { lineasReposicion } from '../cierres/cierreSemanal'
import { ultimaCompraDe, type Compra } from './compras'
import { aplicarCorreccionCompra, corregirCostoCompra } from './correccionCompra'

const producto = { unidadesPorCaja: 20, manejaSixpack: false }
const momento = new Date('2026-03-12T20:00:00.000Z')

/** Crea una compra de ejemplo de una caja. */
const compra = (id: string, fecha: string, costoTotal: number): Compra => ({
  id,
  productoId: 'cerveza-a',
  producto,
  presentacion: 'caja',
  cantidad: 1,
  costoTotal,
  fecha,
  registradoEn: `${fecha}T10:00:00.000Z`,
  estado: 'vigente',
})

const vieja = compra('c1', '2026-03-01', 30000)
// Se capturó 3.000 en vez de 30.000.
const mal = compra('c2', '2026-03-05', 3000)

describe('corregirCostoCompra', () => {
  it('devuelve la compra con el costo nuevo y lo demás igual', () => {
    const { compra: corregida } = corregirCostoCompra({ compra: mal, costoNuevo: 30000, usuario: 'a@example.com', momento })
    expect(corregida).toEqual({ ...mal, costoTotal: 30000 })
  })

  it('no modifica la compra original', () => {
    corregirCostoCompra({ compra: mal, costoNuevo: 30000, usuario: 'a@example.com', momento })
    expect(mal.costoTotal).toBe(3000)
  })

  it('arma el registro de bitácora con antes y después', () => {
    const { registro } = corregirCostoCompra({ compra: mal, costoNuevo: 30000, usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-12T20:00:00.000Z',
      accion: 'corregir-costo-compra',
      antes: mal,
      despues: { ...mal, costoTotal: 30000 },
    })
  })

  it('rechaza un costo nuevo negativo o con decimales', () => {
    expect(() => corregirCostoCompra({ compra: mal, costoNuevo: -1, usuario: 'a@example.com', momento })).toThrow()
    expect(() => corregirCostoCompra({ compra: mal, costoNuevo: 10.5, usuario: 'a@example.com', momento })).toThrow()
  })
})

describe('aplicarCorreccionCompra', () => {
  it('reemplaza la compra con el mismo id y deja las demás', () => {
    const corregida = { ...mal, costoTotal: 30000 }
    expect(aplicarCorreccionCompra([vieja, mal], corregida)).toEqual([vieja, corregida])
  })

  it('si la compra corregida era la última, la última compra refleja el costo nuevo', () => {
    const { compra: corregida } = corregirCostoCompra({ compra: mal, costoNuevo: 30000, usuario: 'a@example.com', momento })
    const compras = aplicarCorreccionCompra([vieja, mal], corregida)
    expect(ultimaCompraDe(compras, 'cerveza-a')?.costoTotal).toBe(30000)
  })

  it('el costo de reposición del cierre usa el costo corregido', () => {
    const { compra: corregida } = corregirCostoCompra({ compra: mal, costoNuevo: 30000, usuario: 'a@example.com', momento })
    const compras = aplicarCorreccionCompra([vieja, mal], corregida)
    const vendidos = [{ productoId: 'cerveza-a', producto: { ...producto, precioUnidad: 2000, precioCaja: 38000 }, presentacion: 'caja' as const, cantidad: 1 }]
    expect(lineasReposicion(vendidos, compras, '2026-03-15').lineas[0].ultimaCompra.costoTotal).toBe(30000)
  })

  it('rechaza una corrección de una compra que no está en la lista', () => {
    expect(() => aplicarCorreccionCompra([vieja], { ...mal, costoTotal: 30000 })).toThrow(/no está/i)
  })
})
