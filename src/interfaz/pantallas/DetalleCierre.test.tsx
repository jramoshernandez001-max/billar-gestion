// @vitest-environment jsdom
/**
 * Pruebas del detalle de un cierre.
 *
 * Qué hace: verifica el resultado, el aviso de desactualizado, recalcular y
 * corregir el dinero contado.
 * Cómo lo hace: servicios falsos con un cierre inventado.
 * Por qué: recalcular y corregir dinero los pide un usuario; nunca son
 * automáticos y quedan en la bitácora.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DetalleCierre, type ServiciosDetalleCierre } from './DetalleCierre'

afterEach(cleanup)

const cierre = {
  id: 'c1', tipo: 'diario' as const, desde: '2026-11-01', hasta: '2026-11-01', calculadoEn: '2026-11-01T23:00:00.000Z', efectivo: 40000, transferencias: 10000, dineroCorregidoEn: null, costosManuales: {}, costosUsados: [],
  resultado: { dineroTotal: 55000, diferencia: -5000, cuadra: false, faltante: 5000, sobrante: 0 },
}

function servicios(sobre: { recalcular?: ServiciosDetalleCierre['servicioCierres']['recalcularCierre']; corregir?: ServiciosDetalleCierre['cierres']['corregirDineroCierre']; desactualizado?: boolean } = {}): ServiciosDetalleCierre {
  return {
    cierres: { listarCierres: async () => [cierre], corregirDineroCierre: sobre.corregir ?? (async () => undefined) },
    desactualizados: { idsDesactualizados: async () => (sobre.desactualizado ? ['c1'] : []) },
    servicioCierres: { recalcularCierre: sobre.recalcular ?? (async () => undefined) },
    inventario: { listarProductos: async () => [] },
  }
}

const dibujar = (s: ServiciosDetalleCierre, cierreId = 'c1', alIr = vi.fn()) => render(<DetalleCierre servicios={s} cierreId={cierreId} alIr={alIr} />)

describe('DetalleCierre', () => {
  it('muestra el periodo y el resultado del cuadre', async () => {
    dibujar(servicios())
    expect(await screen.findByText('Faltante de $ 5.000')).toBeTruthy()
    expect(screen.getByText('$ 40.000')).toBeTruthy()
  })

  it('avisa si está desactualizado y recalcula al pedirlo', async () => {
    const recalcular = vi.fn(async () => undefined)
    dibujar(servicios({ desactualizado: true, recalcular }))
    expect(await screen.findByText(/desactualizado/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Recalcular cierre' }))
    await waitFor(() => expect(recalcular).toHaveBeenCalledWith('c1'))
  })

  it('corrige el efectivo y las transferencias', async () => {
    const corregir = vi.fn(async () => undefined)
    dibujar(servicios({ corregir }))
    await screen.findByText('Faltante de $ 5.000')
    fireEvent.click(screen.getByRole('button', { name: 'Corregir dinero' }))
    fireEvent.change(screen.getByLabelText('Efectivo'), { target: { value: '45000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
    await waitFor(() => expect(corregir).toHaveBeenCalledWith('c1', 45000, 10000))
  })

  it('un cierre que no existe avisa', async () => {
    dibujar(servicios(), 'otro')
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })

  it('si recalcular falla muestra el error', async () => {
    dibujar(servicios({ recalcular: vi.fn(async () => { throw new Error('sin permisos') }) }))
    await screen.findByText('Faltante de $ 5.000')
    fireEvent.click(screen.getByRole('button', { name: 'Recalcular cierre' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin permisos/)
  })
})
