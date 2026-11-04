// @vitest-environment jsdom
/**
 * Pruebas de la navegación inferior.
 *
 * Qué hace: verifica que muestre las cinco pestañas, resalte la activa y
 * avise a dónde ir al tocar una.
 * Cómo lo hace: renderiza el componente con una función espía.
 * Por qué: es la forma de moverse por toda la app en el celular.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NavegacionInferior } from './NavegacionInferior'

afterEach(cleanup)

describe('NavegacionInferior', () => {
  it('muestra las cinco pestañas en orden', () => {
    render(<NavegacionInferior activa="inicio" alIr={() => {}} />)
    const nombres = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nombres).toEqual(['Inicio', 'Vender', 'Inventario', 'Deudas', 'Más'])
  })

  it('marca la pestaña activa para lectores de pantalla', () => {
    render(<NavegacionInferior activa="deudas" alIr={() => {}} />)
    expect(screen.getByRole('button', { name: 'Deudas' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull()
  })

  it('sin pestaña activa no marca ninguna', () => {
    render(<NavegacionInferior activa={null} alIr={() => {}} />)
    expect(document.querySelector('[aria-current]')).toBeNull()
  })

  it('al tocar una pestaña avisa su ruta', () => {
    const alIr = vi.fn()
    render(<NavegacionInferior activa="inicio" alIr={alIr} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inventario' }))
    expect(alIr).toHaveBeenCalledWith('inventario')
  })
})
