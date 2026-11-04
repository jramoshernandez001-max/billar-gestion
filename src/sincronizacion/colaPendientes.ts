/**
 * Cola de operaciones pendientes (modo sin conexión).
 *
 * Qué hace: guarda en el teléfono las operaciones que se registraron sin
 * conexión, con una clave única cada una, hasta que se envían a la base.
 * Cómo lo hace: una lista en JSON dentro de un almacén de texto (en la app,
 * localStorage). Cada cambio se guarda al instante. Al leer se descartan las
 * entradas dañadas. Solo se aceptan las funciones de la lista permitida.
 * Por qué: una venta hecha sin internet no debe perderse. La clave permite
 * reenviar sin duplicar (la base la recuerda, migración 0006). Solo se
 * permiten operaciones que crean registros nuevos; anular, corregir y cerrar
 * dependen de datos al día y exigen conexión.
 */

/** Funciones de la base que se pueden registrar sin conexión. */
export const FUNCIONES_DIFERIBLES = [
  'registrar_venta',
  'registrar_compra',
  'registrar_traslado',
  'registrar_ajuste',
  'registrar_deuda',
  'registrar_abono',
] as const

/** Dice si una función se puede registrar sin conexión. */
export function esDiferible(funcion: string): boolean {
  return (FUNCIONES_DIFERIBLES as readonly string[]).includes(funcion)
}

/** Una operación guardada, esperando enviarse. */
export interface OperacionPendiente {
  clave: string
  funcion: string
  argumentos: Record<string, unknown>
  /** Momento en que la persona la registró (informativo). */
  creadoEn: string
  /** Mensaje de la base si la rechazó; null si sigue esperando. */
  error: string | null
}

/** Lo mínimo que necesita la cola de un almacén de texto. */
export interface AlmacenTexto {
  leer(clave: string): string | null
  guardar(clave: string, texto: string): void
  borrar(clave: string): void
}

/** Cola con las operaciones de lectura y cambio. */
export interface ColaPendientes {
  listar(): OperacionPendiente[]
  agregar(funcion: string, argumentos: Record<string, unknown>): OperacionPendiente
  quitar(clave: string): void
  marcarRechazada(clave: string, error: string): void
  reintentar(clave: string): void
}

const CLAVE_ALMACEN = 'billar.pendientes'

/** Dice si un valor guardado tiene la forma de una operación. */
function esOperacion(valor: unknown): valor is OperacionPendiente {
  if (typeof valor !== 'object' || valor === null) return false
  const v = valor as Record<string, unknown>
  return (
    typeof v.clave === 'string' &&
    typeof v.funcion === 'string' &&
    typeof v.argumentos === 'object' &&
    v.argumentos !== null &&
    typeof v.creadoEn === 'string' &&
    (v.error === null || typeof v.error === 'string')
  )
}

/**
 * Crea la cola sobre un almacén.
 *
 * @param almacen Dónde se guarda el texto.
 * @param generarClave Cómo se crea una clave nueva (por defecto, un uuid).
 * @param ahora Cómo se obtiene el momento actual en ISO.
 */
export function crearCola(
  almacen: AlmacenTexto,
  generarClave: () => string = () => crypto.randomUUID(),
  ahora: () => string = () => new Date().toISOString(),
): ColaPendientes {
  const listar = (): OperacionPendiente[] => {
    let texto: string | null
    try {
      texto = almacen.leer(CLAVE_ALMACEN)
    } catch {
      return []
    }
    if (texto === null) return []
    try {
      const datos: unknown = JSON.parse(texto)
      return Array.isArray(datos) ? datos.filter(esOperacion) : []
    } catch {
      return []
    }
  }

  const guardar = (operaciones: OperacionPendiente[]): void => {
    try {
      almacen.guardar(CLAVE_ALMACEN, JSON.stringify(operaciones))
    } catch {
      throw new Error('No se pudo guardar en el teléfono. Libera espacio o conéctate a internet e inténtalo de nuevo')
    }
  }

  const cambiar = (clave: string, cambio: (o: OperacionPendiente) => OperacionPendiente): void =>
    guardar(listar().map((o) => (o.clave === clave ? cambio(o) : o)))

  return {
    listar,
    agregar(funcion, argumentos) {
      if (!esDiferible(funcion)) throw new Error(`La operación ${funcion} no se puede hacer sin conexión: necesita internet`)
      const operacion: OperacionPendiente = { clave: generarClave(), funcion, argumentos, creadoEn: ahora(), error: null }
      guardar([...listar(), operacion])
      return operacion
    },
    quitar: (clave) => guardar(listar().filter((o) => o.clave !== clave)),
    marcarRechazada: (clave, error) => cambiar(clave, (o) => ({ ...o, error })),
    reintentar: (clave) => cambiar(clave, (o) => ({ ...o, error: null })),
  }
}
