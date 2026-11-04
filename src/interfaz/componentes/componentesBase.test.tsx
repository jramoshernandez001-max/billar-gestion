// @vitest-environment jsdom
/**
 * Pruebas de los componentes comunes: cabecera interna, opciones y fecha.
 *
 * Qué hace: verifica que cada uno muestre lo del diseño y avise cuando la
 * persona actúa.
 * Cómo lo hace: los renderiza con funciones espía.
 * Por qué: se reutilizan en varias pantallas; un fallo aquí rompería todas.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CabeceraInterna } from './CabeceraInterna'
import { CampoFecha } from './CampoFecha'
import { Opciones } from './Opciones'

afterEach(cleanup)

describe('CabeceraInterna', () => {
  it('muestra título y subtítulo y vuelve al tocar la flecha', () => {
    const alVolver = vi.fn()
    render(<CabeceraInterna titulo="Nueva venta" subtitulo="Se descuenta de la nevera" alVolver={alVolver} />)
    expect(screen.getByRole('heading', { name: 'Nueva venta' })).toBeTruthy()
    expect(screen.getByText('Se descuenta de la nevera')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alVolver).toHaveBeenCalled()
  })
})

describe('Opciones', () => {
  const opciones = [
    { valor: 'unidad', etiqueta: 'Unidad' },
    { valor: 'sixpack', etiqueta: 'Sixpack', noDisponible: true },
    { valor: 'caja', etiqueta: 'Caja' },
  ] as const

  it('marca la opción elegida y cambia al tocar otra', () => {
    const alCambiar = vi.fn()
    render(<Opciones nombre="Presentación" opciones={opciones} valor="unidad" alCambiar={alCambiar} />)
    expect(screen.getByRole('radio', { name: 'Unidad' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Caja' }))
    expect(alCambiar).toHaveBeenCalledWith('caja')
  })

  it('una opción no disponible no se puede elegir', () => {
    const alCambiar = vi.fn()
    render(<Opciones nombre="Presentación" opciones={opciones} valor="unidad" alCambiar={alCambiar} />)
    const sixpack = screen.getByRole('radio', { name: 'Sixpack' }) as HTMLButtonElement
    expect(sixpack.disabled).toBe(true)
    fireEvent.click(sixpack)
    expect(alCambiar).not.toHaveBeenCalled()
  })
})

describe('CampoFecha', () => {
  it('escribe "Hoy, …" cuando la fecha es hoy y la fecha sola en otro caso', () => {
    const { rerender } = render(<CampoFecha valor="2026-11-03" hoy="2026-11-03" alCambiar={() => {}} />)
    expect(screen.getByText('Hoy, 03/11/2026')).toBeTruthy()
    rerender(<CampoFecha valor="2026-11-02" hoy="2026-11-03" alCambiar={() => {}} />)
    expect(screen.getByText('02/11/2026')).toBeTruthy()
  })

  it('avisa la nueva fecha y ignora un campo vacío', () => {
    const alCambiar = vi.fn()
    render(<CampoFecha valor="2026-11-03" hoy="2026-11-03" alCambiar={alCambiar} />)
    const campo = screen.getByLabelText('Fecha')
    fireEvent.change(campo, { target: { value: '2026-11-01' } })
    expect(alCambiar).toHaveBeenCalledWith('2026-11-01')
    fireEvent.change(campo, { target: { value: '' } })
    expect(alCambiar).toHaveBeenCalledTimes(1)
  })
})
