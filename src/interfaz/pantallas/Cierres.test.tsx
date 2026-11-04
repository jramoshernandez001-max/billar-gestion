// @vitest-environment jsdom
/**
 * Pruebas del historial de cierres.
 *
 * Qué hace: verifica la lista, el aviso de desactualizado, los filtros y los
 * accesos a cerrar y al detalle.
 * Cómo lo hace: servicios falsos con cierres inventados.
 * Por qué: un cierre desactualizado debe verse a simple vista.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Cierres, type ServiciosCierresPantalla } from './Cierres'

afterEach(cleanup)

const cierre = (id: string, tipo: 'diario' | 'semanal', desde: string, hasta: string, diferencia: number) => ({
  id, tipo, desde, hasta, calculadoEn: `${hasta}T23:00:00.000Z`, efectivo: 40000, transferencias: 10000, dineroCorregidoEn: null, costosManuales: {}, costosUsados: [],
  resultado: tipo === 'diario'
    ? { dineroTotal: 50000, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: diferencia > 0 ? diferencia : 0 }
    : { completo: true, costoReposicion: 1, productosSinCosto: [], ventasSinCosto: 0, comprasUsadas: [], costosUsados: [], cuadre: { dineroTotal: 50000, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: 0 }, utilidad: { utilidadEsperada: 1, utilidadReal: 1, diferencia: 0 } },
})

const servicios: ServiciosCierresPantalla = {
  cierres: { listarCierres: async () => [cierre('c1', 'diario', '2026-11-01', '2026-11-01', 0), cierre('c2', 'semanal', '2026-10-26', '2026-11-01', -4000)] },
  desactualizados: { idsDesactualizados: async () => ['c1'] },
}

describe('Cierres', () => {
  it('lista los cierres con su estado y marca el desactualizado', async () => {
    render(<Cierres servicios={servicios} alIr={vi.fn()} />)
    expect(await screen.findByText('Cierre semanal')).toBeTruthy()
    expect(screen.getByText('Cierre diario')).toBeTruthy()
    expect(screen.getByText('Faltante de $ 4.000')).toBeTruthy()
    expect(screen.getAllByText('Desactualizado')).toHaveLength(1)
  })

  it('filtra por tipo', async () => {
    render(<Cierres servicios={servicios} alIr={vi.fn()} />)
    await screen.findByText('Cierre semanal')
    fireEvent.click(screen.getByRole('radio', { name: 'Diarios' }))
    expect(screen.queryByText('Cierre semanal')).toBeNull()
  })

  it('lleva a cerrar día, cerrar semana y al detalle', async () => {
    const alIr = vi.fn()
    render(<Cierres servicios={servicios} alIr={alIr} />)
    await screen.findByText('Cierre semanal')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar día' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar semana' }))
    fireEvent.click(screen.getByRole('button', { name: /Cierre semanal/ }))
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['cierres/diario', 'cierres/semanal', 'mas/cierres/c2'])
  })

  it('sin cierres lo dice y si falla permite reintentar', async () => {
    render(<Cierres servicios={{ cierres: { listarCierres: async () => [] }, desactualizados: { idsDesactualizados: async () => [] } }} alIr={vi.fn()} />)
    expect(await screen.findByText(/todavía no hay cierres/i)).toBeTruthy()
    cleanup()
    render(<Cierres servicios={{ cierres: { listarCierres: async () => { throw new Error('sin red') } }, desactualizados: { idsDesactualizados: async () => [] } }} alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })
})
