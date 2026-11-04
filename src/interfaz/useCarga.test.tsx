// @vitest-environment jsdom
/**
 * Pruebas del hook de carga de datos.
 *
 * Qué hace: verifica los estados cargando, listo y error, y la recarga.
 * Cómo lo hace: carga una función falsa con renderHook.
 * Por qué: todas las pantallas leen datos con este hook; si no avisa el error
 * o muestra datos viejos de una carga anterior, la pantalla engaña.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useCarga } from './useCarga'

afterEach(cleanup)

describe('useCarga', () => {
  it('pasa de cargando a listo con los datos', async () => {
    const cargar = vi.fn(async () => 'hola')
    const { result } = renderHook(() => useCarga(cargar))
    expect(result.current.estado).toBe('cargando')
    await waitFor(() => expect(result.current.estado).toBe('listo'))
    expect(result.current.datos).toBe('hola')
    expect(result.current.error).toBeNull()
  })

  it('si falla, queda en error con el mensaje', async () => {
    const cargar = vi.fn(async () => {
      throw new Error('sin permisos')
    })
    const { result } = renderHook(() => useCarga(cargar))
    await waitFor(() => expect(result.current.estado).toBe('error'))
    expect(result.current.error).toBe('sin permisos')
    expect(result.current.datos).toBeNull()
  })

  it('recargar vuelve a pedir los datos', async () => {
    let n = 0
    const cargar = vi.fn(async () => ++n)
    const { result } = renderHook(() => useCarga(cargar))
    await waitFor(() => expect(result.current.datos).toBe(1))
    act(() => result.current.recargar())
    await waitFor(() => expect(result.current.datos).toBe(2))
    expect(cargar).toHaveBeenCalledTimes(2)
  })

  it('ignora la respuesta de una carga vieja si la función cambió', async () => {
    let resolverViejo: (v: string) => void = () => {}
    const viejo = () => new Promise<string>((r) => { resolverViejo = r })
    const nuevo = async () => 'nuevo'
    const { result, rerender } = renderHook(({ f }) => useCarga(f), { initialProps: { f: viejo } })
    rerender({ f: nuevo })
    await waitFor(() => expect(result.current.datos).toBe('nuevo'))
    await act(async () => resolverViejo('viejo'))
    expect(result.current.datos).toBe('nuevo')
  })
})
