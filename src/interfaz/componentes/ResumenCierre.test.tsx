// @vitest-environment jsdom
/**
 * Pruebas del resumen de un cierre.
 *
 * Qué hace: verifica que muestre vendido, dinero, deudas, el estado del
 * cuadre y, en el semanal, la utilidad completa o la incompleta.
 * Cómo lo hace: vistas con números hechos a mano.
 * Por qué: es el mismo bloque en la vista previa y en el detalle del cierre.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ResumenCierre } from './ResumenCierre'
import type { VistaCierre } from '../../aplicacion/vistaCierre'

afterEach(cleanup)

const base: VistaCierre = { vendido: 60000, dineroTotal: 60000, efectivo: 40000, transferencias: 10000, deudas: 10000, estado: 'cuadra', monto: 0, semanal: null }

describe('ResumenCierre', () => {
  it('diario que cuadra', () => {
    render(<ResumenCierre vista={base} />)
    expect(screen.getByText('Cuadra')).toBeTruthy()
    expect(screen.getByText('$ 60.000', { selector: '.dato__total' })).toBeTruthy()
    expect(screen.getByText('$ 40.000')).toBeTruthy()
    expect(screen.getByText('$ 10.000', { selector: '[data-dato="deudas"]' })).toBeTruthy()
  })

  it('faltante y sobrante dicen cuánto', () => {
    render(<ResumenCierre vista={{ ...base, estado: 'faltante', monto: 5000 }} />)
    expect(screen.getByText('Faltante de $ 5.000')).toBeTruthy()
    cleanup()
    render(<ResumenCierre vista={{ ...base, estado: 'sobrante', monto: 3000 }} />)
    expect(screen.getByText('Sobrante de $ 3.000')).toBeTruthy()
  })

  it('semanal completo muestra utilidad esperada, real y diferencia', () => {
    render(<ResumenCierre vista={{ ...base, semanal: { completo: true, costoReposicion: 30000, utilidadEsperada: 35000, utilidadReal: 33000, diferenciaUtilidad: -2000, ventasSinCosto: 0, productosSinCosto: [], comprasUsadas: 2 } }} />)
    expect(screen.getByText('Utilidad esperada')).toBeTruthy()
    expect(screen.getByText('$ 33.000')).toBeTruthy()
    expect(screen.getByText('−$ 2.000')).toBeTruthy()
    expect(screen.getByText('2 compras usadas como costo')).toBeTruthy()
  })

  it('semanal incompleto avisa, no muestra utilidad real y lista los productos sin costo', () => {
    render(<ResumenCierre vista={{ ...base, semanal: { completo: false, costoReposicion: 30000, utilidadEsperada: 20000, utilidadReal: null, diferenciaUtilidad: null, ventasSinCosto: 12000, productosSinCosto: [{ id: 'p2', nombre: 'Agua Ejemplo' }], comprasUsadas: 1 } }} />)
    expect(screen.getByText(/incompleto/i)).toBeTruthy()
    expect(screen.queryByText('Utilidad real')).toBeNull()
    expect(screen.getByText('Agua Ejemplo')).toBeTruthy()
    expect(screen.getByText('$ 12.000', { selector: '[data-dato="sin-costo"]' })).toBeTruthy()
  })
})
