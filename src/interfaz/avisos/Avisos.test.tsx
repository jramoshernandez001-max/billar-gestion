// @vitest-environment jsdom
/**
 * Pruebas de las ventanitas emergentes.
 *
 * Qué hace: verifica que un aviso aparezca, se quite solo y que sin
 * proveedor no falle nada.
 * Cómo lo hace: un componente de prueba llama a mostrar; temporizadores
 * falsos adelantan el tiempo.
 * Por qué: un aviso que no se quita taparía la pantalla.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProveedorAvisos } from './Avisos'
import { DURACION_AVISO_MS, useAvisos } from './contextoAvisos'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Boton() {
  const avisos = useAvisos()
  return <button type="button" onClick={() => avisos.mostrar('Venta registrada con éxito')}>Guardar</button>
}

describe('avisos', () => {
  it('muestra el aviso y lo quita solo', () => {
    vi.useFakeTimers()
    render(<ProveedorAvisos><Boton /></ProveedorAvisos>)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('status').textContent).toBe('Venta registrada con éxito')
    act(() => { vi.advanceTimersByTime(DURACION_AVISO_MS) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sin proveedor, mostrar no hace nada', () => {
    render(<Boton />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))).not.toThrow()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
