/**
 * Pruebas de la composición del modo sin conexión.
 *
 * Qué hace: verifica que el envío use los parámetros reales de
 * `aplicar_operacion_pendiente`, que cada función permitida lea de la base
 * exactamente los parámetros que ya tiene, y que el conjunto completo
 * funcione de punta a punta con un cliente falso.
 * Cómo lo hace: compara con el SQL de las migraciones (parametrosSql) y
 * simula una caída y una recuperación de la red.
 * Por qué: un nombre de parámetro mal escrito solo se notaría al sincronizar
 * en el local; esta prueba lo atrapa antes.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ClienteDatos } from '../datos/clienteDatos'
import { parametrosSql } from '../datos/apoyoPruebas'
import { FUNCIONES_DIFERIBLES } from './colaPendientes'
import { crearSincronizacion } from './composicionSincronizacion'

const migraciones = import.meta.glob('../../supabase/migrations/0006_*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sql0006 = Object.values(migraciones)[0].replace(/--[^\n]*/g, '')

function storageFalso(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  }
}

describe('aplicar_operacion_pendiente', () => {
  it('cada función permitida lee del json los mismos parámetros que ya tiene', () => {
    const ramas = sql0006.split(/\n\s+when '/).slice(1)
    expect(ramas.length).toBe(FUNCIONES_DIFERIBLES.length)
    for (const rama of ramas) {
      const funcion = rama.match(/^(\w+)'/)?.[1] ?? ''
      const leidos = [...rama.matchAll(/p_argumentos\s*(?:->>|->)\s*'(p_\w+)'/g)].map((m) => m[1])
      expect(leidos, funcion).toEqual(parametrosSql(funcion))
    }
  })

  it('el envío llama con p_clave, p_funcion y p_argumentos', async () => {
    const rpc = vi.fn<ClienteDatos['rpc']>().mockResolvedValue({ data: 'x', error: null })
    const cliente: ClienteDatos = { rpc, from: vi.fn() }
    const s = crearSincronizacion({ cliente, storage: storageFalso(), ventana: new EventTarget(), estaEnLinea: () => true })
    await s.servicio.ejecutar('registrar_venta', { p_fecha: '2026-11-04', p_items: [] })
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('aplicar_operacion_pendiente')
    expect(Object.keys(args)).toEqual(parametrosSql('aplicar_operacion_pendiente'))
    expect(args).toMatchObject({ p_funcion: 'registrar_venta', p_argumentos: { p_fecha: '2026-11-04', p_items: [] } })
  })
})

describe('de punta a punta', () => {
  it('sin red guarda; al volver la red envía una vez con la misma clave', async () => {
    const estado = { enLinea: false }
    const rpc = vi.fn<ClienteDatos['rpc']>().mockResolvedValue({ data: 'venta-7', error: null })
    const cliente: ClienteDatos = { rpc, from: vi.fn() }
    const s = crearSincronizacion({ cliente, storage: storageFalso(), ventana: new EventTarget(), estaEnLinea: () => estado.enLinea })
    const r = await s.cliente.rpc('registrar_venta', { p_fecha: '2026-11-04', p_items: [] })
    expect(String(r.data)).toMatch(/^pendiente:/)
    expect(rpc).not.toHaveBeenCalled()
    estado.enLinea = true
    await s.servicio.sincronizar()
    await s.servicio.sincronizar()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(s.servicio.estado().pendientes).toBe(0)
  })

  it('lo pendiente sobrevive a reabrir la app (mismo storage)', async () => {
    const storage = storageFalso()
    const cliente: ClienteDatos = { rpc: vi.fn().mockResolvedValue({ data: 'x', error: null }), from: vi.fn() }
    const a = crearSincronizacion({ cliente, storage, ventana: new EventTarget(), estaEnLinea: () => false })
    await a.cliente.rpc('registrar_compra', {})
    const b = crearSincronizacion({ cliente, storage, ventana: new EventTarget(), estaEnLinea: () => true })
    expect(b.servicio.estado().pendientes).toBe(1)
  })
})
