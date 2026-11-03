/**
 * Ayudas compartidas por las pruebas de los repositorios de datos.
 *
 * Qué hace: ofrece un cliente de datos falso y la lectura de los nombres de
 * parámetros de las funciones SQL.
 * Cómo lo hace: el cliente falso registra las llamadas a rpc; los parámetros
 * se leen con una expresión regular sobre el texto de las migraciones.
 * Por qué: cada repositorio comprueba lo mismo (nombres exactos y errores) y
 * así no se repite el código en cada archivo de pruebas.
 */
import { vi } from 'vitest'
import type { ClienteDatos } from './clienteDatos'

/** Migraciones como texto, para leer los parámetros de cada función. */
const migraciones = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sql = Object.values(migraciones).join('\n').replace(/\r\n/g, '\n')

/** Nombres de parámetros de una función SQL, en orden. */
export function parametrosSql(funcion: string): string[] {
  const definicion = sql.match(new RegExp(`create function public\\.${funcion}\\(([\\s\\S]*?)\\)\\s*returns`, 'i'))
  if (definicion === null) throw new Error(`no se encontró la función ${funcion}`)
  return [...definicion[1].matchAll(/\bp_\w+/g)].map((m) => m[0])
}

/** Cliente falso: respuesta de rpc y filas por tabla configurables. */
export function clienteFalso(
  respuesta: { data?: unknown; error?: string } = {},
  filas: Record<string, unknown[]> = {},
) {
  const rpc = vi.fn<ClienteDatos['rpc']>(async () => ({
    data: respuesta.data ?? null,
    error: respuesta.error ? { message: respuesta.error } : null,
  }))
  const cliente: ClienteDatos = {
    rpc,
    from: (tabla: string) => ({
      select: async () => ({ data: filas[tabla] ?? [], error: null }),
    }),
  }
  return { cliente, rpc }
}
