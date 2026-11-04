// @vitest-environment jsdom
/**
 * Pruebas del aviso de conexión.
 *
 * Qué hace: verifica que el hook siga el estado en línea del navegador y que
 * el aviso aparezca solo sin conexión.
 * Cómo lo hace: simula los eventos online y offline del navegador.
 * Por qué: sin conexión no se puede guardar nada en la base; la persona debe
 * enterarse antes de registrar algo que se perdería.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AvisoSinConexion } from './componentes/AvisoSinConexion'

afterEach(() => {
  cleanup()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

const poner = (enLinea: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
  act(() => { window.dispatchEvent(new Event(enLinea ? 'online' : 'offline')) })
}

describe('AvisoSinConexion', () => {
  it('no se ve con conexión', () => {
    render(<AvisoSinConexion />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('aparece al perder la conexión y desaparece al volver', () => {
    render(<AvisoSinConexion />)
    poner(false)
    expect(screen.getByRole('status').textContent).toMatch(/sin conexión/i)
    poner(true)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('si ya empieza sin conexión, se ve de inmediato', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    render(<AvisoSinConexion />)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
