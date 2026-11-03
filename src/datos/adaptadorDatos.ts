/**
 * Adaptador de datos de Supabase.
 *
 * Qué hace: convierte el cliente de Supabase en el ClienteDatos que usan los
 * repositorios.
 * Cómo lo hace: reenvía rpc y las lecturas (select) al cliente de Supabase,
 * describiendo solo lo que se usa de él (ClienteSupabaseDatos).
 * Por qué: junto con el adaptador de autenticación, es el único código que
 * conoce a Supabase; los repositorios dependen de ClienteDatos y se prueban
 * sin red. La seguridad no está aquí: la base valida al usuario en cada
 * función y RLS limita las lecturas.
 */
import type { ClienteDatos, ErrorBaseDeDatos } from './clienteDatos'

/** Lo único que se usa del cliente de Supabase para datos. */
export interface ClienteSupabaseDatos {
  rpc(
    nombre: string,
    argumentos?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: ErrorBaseDeDatos | null }>
  from(tabla: string): {
    select(columnas?: string): PromiseLike<{ data: unknown[] | null; error: ErrorBaseDeDatos | null }>
  }
}

/**
 * Adapta un cliente de Supabase a ClienteDatos.
 *
 * Qué hace: devuelve rpc y from con la forma que esperan los repositorios.
 * Cómo lo hace: reenvía cada llamada; si no se piden columnas, lee todas.
 * Por qué: ver el comentario del archivo.
 */
export function adaptarClienteDatos(supabase: ClienteSupabaseDatos): ClienteDatos {
  return {
    rpc: (nombre, argumentos) => supabase.rpc(nombre, argumentos),
    from: (tabla) => ({
      select: (columnas = '*') => supabase.from(tabla).select(columnas),
    }),
  }
}
