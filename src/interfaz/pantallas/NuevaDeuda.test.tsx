// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Nueva deuda".
 *
 * Qué hace: verifica los campos, la validación, el guardado y el error del
 * servidor.
 * Cómo lo hace: servicio falso que registra la llamada.
 * Por qué: una deuda mal registrada cambia el cuadre de los cierres.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NuevaDeuda } from './NuevaDeuda'

afterEach(cleanup)

const llenar = () => {
  fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: ' Ana  Ruiz ' } })
  fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '15000' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Fiado de cervezas' } })
}

describe('NuevaDeuda', () => {
  it('no deja guardar sin datos', () => {
    render(<NuevaDeuda servicios={{ deudas: { registrarDeuda: vi.fn() } }} hoy="2026-11-03" alIr={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Guardar deuda' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('registra la deuda con la fecha elegida y vuelve a la lista', async () => {
    const registrarDeuda = vi.fn(async () => 'd')
    const alIr = vi.fn()
    render(<NuevaDeuda servicios={{ deudas: { registrarDeuda } }} hoy="2026-11-03" alIr={alIr} />)
    llenar()
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar deuda' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('deudas'))
    expect(registrarDeuda).toHaveBeenCalledWith({ cliente: 'Ana Ruiz', fecha: '2026-11-02', monto: 15000, descripcion: 'Fiado de cervezas' })
  })

  it('muestra el error del servidor y no navega', async () => {
    const alIr = vi.fn()
    render(<NuevaDeuda servicios={{ deudas: { registrarDeuda: async () => { throw new Error('sin permisos') } } }} hoy="2026-11-03" alIr={alIr} />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar deuda' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin permisos/)
    expect(alIr).not.toHaveBeenCalled()
  })
})
