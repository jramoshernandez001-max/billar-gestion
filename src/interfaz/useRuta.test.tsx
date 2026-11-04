// @vitest-environment jsdom
/**
 * Pruebas del hook de ruta.
 *
 * Qué hace: verifica que siga la ruta de la dirección (#/...) y que `ir`
 * cambie de pantalla.
 * Cómo lo hace: usa la dirección real de jsdom y el evento hashchange.
 * Por qué: el botón "atrás" del celular debe volver a la pantalla anterior.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useRuta } from './useRuta'

beforeEach(() => {
  window.location.hash = ''
})
afterEach(cleanup)

describe('useRuta', () => {
  it('empieza en la ruta de la dirección, o en inicio', () => {
    expect(renderHook(() => useRuta()).result.current.ruta).toBe('inicio')
    cleanup()
    window.location.hash = '#/deudas'
    expect(renderHook(() => useRuta()).result.current.ruta).toBe('deudas')
  })

  it('ir cambia la ruta y la dirección', () => {
    const { result } = renderHook(() => useRuta())
    act(() => result.current.ir('inventario/trasladar'))
    expect(result.current.ruta).toBe('inventario/trasladar')
    expect(window.location.hash).toBe('#/inventario/trasladar')
  })

  it('sigue los cambios de dirección hechos por fuera (botón atrás)', () => {
    const { result } = renderHook(() => useRuta())
    act(() => {
      window.location.hash = '#/vender'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current.ruta).toBe('vender')
  })
})
