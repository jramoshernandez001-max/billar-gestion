// @vitest-environment jsdom
/**
 * Pruebas del detalle de una entrada de la bitácora.
 *
 * Qué hace: verifica el título, quién y cuándo, el motivo y la comparación
 * antes y después.
 * Cómo lo hace: servicio falso con una entrada inventada.
 * Por qué: es la evidencia de una corrección o anulación.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DetalleBitacora } from './DetalleBitacora'
import type { EntradaBitacora } from '../../datos/bitacora'

afterEach(cleanup)

const entrada: EntradaBitacora = {
  id: 'b1', momento: new Date(2026, 10, 3, 14, 5).toISOString(), usuario: 'ana@ejemplo.com', accion: 'corregir-costo-compra', tabla: 'compras', registroId: 'c1',
  antes: { id: 'c1', costo_total: 96000, estado: 'vigente' }, despues: { id: 'c1', costo_total: 100800, estado: 'vigente' }, motivo: 'precio mal digitado',
}

const servicios = { bitacora: { listarBitacora: async () => [entrada] }, inventario: { listarProductos: async () => [] } }

describe('DetalleBitacora', () => {
  it('muestra título, usuario, motivo y solo lo que cambió', async () => {
    render(<DetalleBitacora servicios={servicios} entradaId="b1" alIr={vi.fn()} />)
    expect(await screen.findByText('Costo de compra corregido')).toBeTruthy()
    expect(screen.getByText('ana@ejemplo.com')).toBeTruthy()
    expect(screen.getByText('precio mal digitado')).toBeTruthy()
    expect(screen.getByText('Costo total')).toBeTruthy()
    expect(screen.getByText('$ 96.000')).toBeTruthy()
    expect(screen.getByText('$ 100.800')).toBeTruthy()
    expect(screen.queryByText('Estado')).toBeNull()
  })

  it('dice dónde fue el cambio', async () => {
    render(<DetalleBitacora servicios={servicios} entradaId="b1" alIr={vi.fn()} />)
    expect(await screen.findByText('Compras')).toBeTruthy()
  })

  it('una entrada que no existe avisa', async () => {
    render(<DetalleBitacora servicios={servicios} entradaId="otra" alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })
})
