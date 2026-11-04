// @vitest-environment jsdom
/**
 * Pruebas de la ventana emergente.
 *
 * Qué hace: verifica el rol de diálogo, el título, y que se cierre con
 * Escape, con el botón Cerrar y al tocar el fondo (no al tocar dentro).
 * Cómo lo hace: renderiza el modal con una función de cierre espía.
 * Por qué: todas las ventanas de la app (anular, etc.) usan este componente;
 * debe poder usarse con teclado y lector de pantalla.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('es un diálogo con título y contenido', () => {
    render(<Modal titulo="Anular venta" alCerrar={vi.fn()}><p>Contenido</p></Modal>)
    const dialogo = screen.getByRole('dialog', { name: 'Anular venta' })
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Contenido')).toBeTruthy()
  })

  it('se cierra con Escape', () => {
    const alCerrar = vi.fn()
    render(<Modal titulo="T" alCerrar={alCerrar}>x</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('se cierra con el botón Cerrar y al tocar el fondo, pero no al tocar dentro', () => {
    const alCerrar = vi.fn()
    render(<Modal titulo="T" alCerrar={alCerrar}><p>dentro</p></Modal>)
    fireEvent.click(screen.getByText('dentro'))
    expect(alCerrar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(alCerrar).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('fondo-modal'))
    expect(alCerrar).toHaveBeenCalledTimes(2)
  })

  it('al cerrarse deja de escuchar Escape', () => {
    const alCerrar = vi.fn()
    const { unmount } = render(<Modal titulo="T" alCerrar={alCerrar}>x</Modal>)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCerrar).not.toHaveBeenCalled()
  })
})
