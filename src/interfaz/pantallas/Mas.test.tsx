// @vitest-environment jsdom
/**
 * Pruebas del menú "Más".
 *
 * Qué hace: verifica los accesos a las secciones, la cuenta y cerrar sesión.
 * Cómo lo hace: renderiza con funciones falsas.
 * Por qué: es la puerta a todo lo que no cabe en la barra inferior.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Mas } from './Mas'

afterEach(cleanup)

describe('Mas', () => {
  it('lleva a cada sección', () => {
    const alIr = vi.fn()
    render(<Mas correo="ana@ejemplo.com" alIr={alIr} cerrarSesion={vi.fn()} />)
    for (const nombre of ['Ventas', 'Compras', 'Productos', 'Cierres', 'Bitácora', 'Resúmenes']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(nombre) }))
    }
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['mas/ventas', 'mas/compras', 'mas/productos', 'mas/cierres', 'mas/bitacora', 'mas/resumenes'])
  })

  it('muestra la cuenta y permite cerrar sesión', () => {
    const cerrarSesion = vi.fn()
    render(<Mas correo="ana@ejemplo.com" alIr={vi.fn()} cerrarSesion={cerrarSesion} />)
    expect(screen.getByText('ana@ejemplo.com')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(cerrarSesion).toHaveBeenCalled()
  })
})
