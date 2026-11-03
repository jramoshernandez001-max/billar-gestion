/**
 * Pruebas del adaptador de datos de Supabase.
 *
 * Qué hace: verifica que el adaptador reenvíe rpc y lecturas al cliente de
 * Supabase y que el cliente real de Supabase sea compatible con lo que usa.
 * Cómo lo hace: un cliente falso registra las llamadas; una función solo de
 * tipos comprueba la compatibilidad con createClient en la compilación.
 * Por qué: si Supabase cambia su forma, la compilación falla aquí y no en
 * producción.
 */
import { describe, it, expect, vi } from 'vitest'
import { adaptarClienteDatos, type ClienteSupabaseDatos } from './adaptadorDatos'
import { crearClienteSupabase } from '../autenticacion/adaptadorSupabase'

/** Solo tipos: el cliente real de Supabase debe poder adaptarse. */
export function compatibleConSupabase(cliente: ReturnType<typeof crearClienteSupabase>) {
  return adaptarClienteDatos(cliente)
}

describe('adaptarClienteDatos', () => {
  it('reenvía rpc con nombre y argumentos', async () => {
    const rpc = vi.fn(async () => ({ data: 'ok', error: null }))
    const supabase = { rpc, from: vi.fn() } as unknown as ClienteSupabaseDatos
    const cliente = adaptarClienteDatos(supabase)
    expect(await cliente.rpc('registrar_venta', { p_fecha: '2026-11-03' })).toEqual({ data: 'ok', error: null })
    expect(rpc).toHaveBeenCalledWith('registrar_venta', { p_fecha: '2026-11-03' })
  })

  it('reenvía la lectura de una tabla con sus columnas', async () => {
    const select = vi.fn(async () => ({ data: [{ id: 1 }], error: null }))
    const from = vi.fn(() => ({ select }))
    const cliente = adaptarClienteDatos({ rpc: vi.fn(), from } as unknown as ClienteSupabaseDatos)
    expect(await cliente.from('productos').select('id')).toEqual({ data: [{ id: 1 }], error: null })
    expect(from).toHaveBeenCalledWith('productos')
    expect(select).toHaveBeenCalledWith('id')
  })

  it('sin columnas lee todas', async () => {
    const select = vi.fn(async () => ({ data: [], error: null }))
    const cliente = adaptarClienteDatos({ rpc: vi.fn(), from: () => ({ select }) } as unknown as ClienteSupabaseDatos)
    await cliente.from('ventas').select()
    expect(select).toHaveBeenCalledWith('*')
  })
})
