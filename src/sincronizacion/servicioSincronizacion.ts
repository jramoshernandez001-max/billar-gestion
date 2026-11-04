/**
 * Servicio de sincronización (modo sin conexión).
 *
 * Qué hace: ejecuta las operaciones de registro guardándolas primero en la
 * cola, las envía a la base y reenvía las que quedaron pendientes al volver
 * internet. Informa su estado (pendientes y rechazadas) a quien se suscriba.
 * Cómo lo hace: `ejecutar` guarda la operación (con su clave) antes de
 * enviar; si el envío funciona la quita, si falla la red la deja pendiente y
 * si la base responde con un error la quita y lo devuelve a la persona.
 * `sincronizar` envía las pendientes en orden: ante un fallo de red se
 * detiene, ante un error de la base marca esa operación como rechazada y
 * sigue con las demás. Solo corre una sincronización a la vez.
 * Por qué: guardar antes de enviar evita perder una venta si la app se cierra
 * en medio de la petición; la clave hace seguro reenviar (la base no duplica).
 * Un error de la base no se reintenta solo porque volvería a fallar: queda
 * visible para que la persona decida (reintentar o descartar).
 */
import { esErrorDeRed } from './errorDeRed'
import type { ColaPendientes, OperacionPendiente } from './colaPendientes'

/** Respuesta de la base al enviar una operación. */
export interface RespuestaEnvio {
  data: unknown
  error: { message: string; code?: string } | null
}

/** Cómo se envía una operación a la base (con su clave). */
export type Envio = (
  clave: string,
  funcion: string,
  argumentos: Record<string, unknown>,
) => PromiseLike<RespuestaEnvio>

/** Resultado de ejecutar una operación. */
export type ResultadoEjecucion =
  | { tipo: 'aplicada'; data: unknown }
  | { tipo: 'pendiente'; clave: string }
  | { tipo: 'rechazada'; error: string }

/** Lo que muestra la interfaz de la sincronización. */
export interface EstadoSincronizacion {
  /** Operaciones esperando enviarse. */
  pendientes: number
  /** Operaciones que la base rechazó. */
  rechazadas: OperacionPendiente[]
  /** True mientras se está enviando. */
  sincronizando: boolean
}

export interface ServicioSincronizacion {
  ejecutar(funcion: string, argumentos: Record<string, unknown>): Promise<ResultadoEjecucion>
  /** Envía las pendientes. Con `forzar`, no mira si el navegador dice que hay conexión. */
  sincronizar(forzar?: boolean): Promise<void>
  reintentar(clave: string): void
  descartar(clave: string): void
  estado(): EstadoSincronizacion
  suscribir(oyente: () => void): () => void
}

interface Dependencias {
  cola: ColaPendientes
  enviar: Envio
  estaEnLinea: () => boolean
}

/** Envía una operación y la clasifica: aplicada, fallo de red o error de la base. */
async function intentar(
  enviar: Envio,
  operacion: OperacionPendiente,
): Promise<{ tipo: 'aplicada'; data: unknown } | { tipo: 'red' } | { tipo: 'base'; error: string }> {
  try {
    const { data, error } = await enviar(operacion.clave, operacion.funcion, operacion.argumentos)
    if (error === null) return { tipo: 'aplicada', data }
    return esErrorDeRed(error) ? { tipo: 'red' } : { tipo: 'base', error: error.message }
  } catch (causa) {
    if (esErrorDeRed(causa)) return { tipo: 'red' }
    return { tipo: 'base', error: causa instanceof Error ? causa.message : String(causa) }
  }
}

export function crearServicioSincronizacion({ cola, enviar, estaEnLinea }: Dependencias): ServicioSincronizacion {
  const oyentes = new Set<() => void>()
  let sincronizando = false
  let enCurso: Promise<void> | null = null

  const calcular = (): EstadoSincronizacion => {
    const todas = cola.listar()
    return {
      pendientes: todas.filter((o) => o.error === null).length,
      rechazadas: todas.filter((o) => o.error !== null),
      sincronizando,
    }
  }
  let actual = calcular()

  /** Recalcula el estado y avisa solo si cambió, para que el objeto sea estable. */
  const avisar = (): void => {
    const nuevo = calcular()
    if (JSON.stringify(nuevo) === JSON.stringify(actual)) return
    actual = nuevo
    oyentes.forEach((oyente) => oyente())
  }

  const enviarTodas = async (): Promise<void> => {
    sincronizando = true
    avisar()
    try {
      for (const operacion of cola.listar().filter((o) => o.error === null)) {
        const resultado = await intentar(enviar, operacion)
        if (resultado.tipo === 'red') return
        if (resultado.tipo === 'aplicada') cola.quitar(operacion.clave)
        else cola.marcarRechazada(operacion.clave, resultado.error)
        avisar()
      }
    } finally {
      sincronizando = false
      avisar()
    }
  }

  return {
    async ejecutar(funcion, argumentos) {
      const operacion = cola.agregar(funcion, argumentos)
      avisar()
      if (!estaEnLinea()) return { tipo: 'pendiente', clave: operacion.clave }
      const resultado = await intentar(enviar, operacion)
      if (resultado.tipo === 'red') return { tipo: 'pendiente', clave: operacion.clave }
      cola.quitar(operacion.clave)
      avisar()
      return resultado.tipo === 'aplicada'
        ? { tipo: 'aplicada', data: resultado.data }
        : { tipo: 'rechazada', error: resultado.error }
    },

    sincronizar(forzar = false) {
      if (enCurso !== null) return enCurso
      if (!forzar && !estaEnLinea()) return Promise.resolve()
      enCurso = enviarTodas().finally(() => {
        enCurso = null
      })
      return enCurso
    },

    reintentar(clave) {
      cola.reintentar(clave)
      avisar()
    },
    descartar(clave) {
      cola.quitar(clave)
      avisar()
    },
    estado: () => actual,
    suscribir(oyente) {
      oyentes.add(oyente)
      return () => void oyentes.delete(oyente)
    },
  }
}
