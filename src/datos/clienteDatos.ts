/**
 * Contrato del cliente de datos y utilidades para usarlo.
 *
 * Qué hace: describe lo mínimo que la app necesita de la base de datos
 * (llamar funciones y leer tablas) y ofrece dos ayudas que convierten los
 * errores de la base en errores de JavaScript con su mensaje.
 * Cómo lo hace: una interfaz con la misma forma que el cliente de Supabase,
 * para pasarle el cliente real sin adaptarlo, y dos funciones pequeñas.
 * Por qué: los repositorios dependen de esta interfaz y no de Supabase, así
 * se prueban con un cliente falso. Los mensajes de las funciones de la base
 * ya están en español y dicen qué pasó, así que se muestran tal cual.
 */

/** Error que devuelve la base de datos. */
export interface ErrorBaseDeDatos {
  message: string
}

/** Lo que la app necesita de la base de datos. */
export interface ClienteDatos {
  /** Llama a una función de la base con parámetros por nombre. */
  rpc(
    nombre: string,
    argumentos: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: ErrorBaseDeDatos | null }>
  /** Empieza una lectura de una tabla o vista. */
  from(tabla: string): {
    select(columnas?: string): PromiseLike<{ data: unknown[] | null; error: ErrorBaseDeDatos | null }>
  }
}

/**
 * Llama a una función de la base y devuelve su respuesta.
 *
 * Qué hace: ejecuta la función y devuelve lo que respondió.
 * Cómo lo hace: si la base devuelve un error, lanza un Error con su mensaje.
 * Por qué: así quien llama usa try/catch y muestra el mensaje de la base.
 *
 * @throws Error con el mensaje de la base de datos.
 */
export async function llamarFuncion(
  cliente: ClienteDatos,
  nombre: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await cliente.rpc(nombre, argumentos)
  if (error !== null) throw new Error(error.message)
  return data
}

/**
 * Lee todas las filas de una tabla o vista.
 *
 * Qué hace: devuelve las filas (una lista vacía si no hay).
 * Cómo lo hace: select de las columnas pedidas; si hay un error lo lanza.
 * Por qué: RLS decide qué filas ve cada usuario; aquí solo se lee.
 *
 * @throws Error con el mensaje de la base de datos.
 */
export async function leerFilas(
  cliente: ClienteDatos,
  tabla: string,
  columnas: string,
): Promise<unknown[]> {
  const { data, error } = await cliente.from(tabla).select(columnas)
  if (error !== null) throw new Error(error.message)
  return data ?? []
}
