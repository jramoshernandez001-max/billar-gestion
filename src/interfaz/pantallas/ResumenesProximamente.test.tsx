// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Resúmenes" (próximamente).
 *
 * Qué hace: verifica el mensaje y que se pueda volver a Más.
 * Cómo lo hace: renderiza con una función de navegación falsa.
 * Por qué: la ruta existe en el menú; no debe quedar en blanco.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ResumenesProximamente } from './ResumenesProximamente'

afterEach(cleanup)

describe('ResumenesProximamente', () => {
  it('avisa que llegará pronto y vuelve a Más', () => {
    const alIr = vi.fn()
    render(<ResumenesProximamente alIr={alIr} />)
    expect(screen.getByRole('heading', { name: 'Resúmenes' })).toBeTruthy()
    expect(screen.getByText(/próximamente/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alIr).toHaveBeenCalledWith('mas')
  })
})
