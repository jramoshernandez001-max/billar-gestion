/**
 * Cliente de datos con modo sin conexión.
 *
 * Qué hace: envuelve el cliente de datos para que (1) los registros nuevos
 * (venta, compra, traslado, ajuste, deuda, abono) pasen por la cola de
 * sincronización, (2) las demás escrituras exijan conexión con un mensaje
 * claro y (3) las lecturas devuelvan la última copia guardada cuando no hay
 * red.
 * Cómo lo hace: es un decorador de `ClienteDatos`, así los repositorios no
 * cambian. Una operación en cola devuelve el id "pendiente:<clave>" para que
 * la pantalla siga su camino; la franja de pendientes avisa a la persona.
 * Las copias de lectura se guardan en el almacén con el prefijo
 * `billar.cache.` y se borran al cerrar sesión.
 * Por qué: el local no siempre tiene buena señal y la venta no puede esperar.
 * Solo se acepta sin conexión lo que crea registros nuevos; anular, corregir
 * y cerrar dependen de datos al día. Un error de la base nunca usa la copia:
 * solo un fallo de red, para no esconder problemas de permisos.
 */
import type { ClienteDatos, ErrorBaseDeDatos } from '../datos/clienteDatos'
import { esDiferible, type AlmacenTexto } from './colaPendientes'
import { esErrorDeRed } from './errorDeRed'
import type { ServicioSincronizacion } from './servicioSincronizacion'

/** Almacén que además puede listar sus claves (para borrar las copias). */
export interface AlmacenConClaves extends AlmacenTexto {
  claves(): string[]
}

/** Prefijo de las copias de lectura en el almacén. */
const PREFIJO_COPIA = 'billar.cache.'

/** Prefijo del id que se devuelve cuando la operación quedó en cola. */
export const PREFIJO_ID_PENDIENTE = 'pendiente:'

/** Dice si un id devuelto por un repositorio corresponde a una operación en cola. */
export function esIdPendiente(id: string): boolean {
  return id.startsWith(PREFIJO_ID_PENDIENTE)
}

const MENSAJE_SIN_CONEXION = 'Sin conexión: esta acción necesita conexión a internet'

interface Dependencias {
  cliente: ClienteDatos
  servicio: Pick<ServicioSincronizacion, 'ejecutar'>
  almacen: AlmacenConClaves
  estaEnLinea: () => boolean
}

export type ClienteSincronizado = ClienteDatos & { limpiarCache(): void }

type Respuesta = { data: unknown; error: ErrorBaseDeDatos | null }

export function crearClienteSincronizado({ cliente, servicio, almacen, estaEnLinea }: Dependencias): ClienteSincronizado {
  /** Escritura que necesita conexión: se niega sin red o se explica si la red falla. */
  const escrituraConConexion = async (nombre: string, argumentos: Record<string, unknown>): Promise<Respuesta> => {
    if (!estaEnLinea()) return { data: null, error: { message: MENSAJE_SIN_CONEXION } }
    try {
      const respuesta = await cliente.rpc(nombre, argumentos)
      if (respuesta.error !== null && esErrorDeRed(respuesta.error)) {
        return { data: null, error: { message: MENSAJE_SIN_CONEXION } }
      }
      return respuesta
    } catch (causa) {
      if (esErrorDeRed(causa)) return { data: null, error: { message: MENSAJE_SIN_CONEXION } }
      throw causa
    }
  }

  const guardarCopia = (clave: string, filas: unknown[]): void => {
    try {
      almacen.guardar(clave, JSON.stringify({ guardadoEn: new Date().toISOString(), filas }))
    } catch {
      // Sin espacio: la lectura sigue funcionando, solo no habrá copia.
    }
  }

  const leerCopia = (clave: string): unknown[] | null => {
    try {
      const texto = almacen.leer(clave)
      if (texto === null) return null
      const copia: unknown = JSON.parse(texto)
      const filas = (copia as { filas?: unknown }).filas
      return Array.isArray(filas) ? filas : null
    } catch {
      return null
    }
  }

  return {
    async rpc(nombre, argumentos) {
      if (!esDiferible(nombre)) return escrituraConConexion(nombre, argumentos)
      const resultado = await servicio.ejecutar(nombre, argumentos)
      if (resultado.tipo === 'aplicada') return { data: resultado.data, error: null }
      if (resultado.tipo === 'pendiente') return { data: `${PREFIJO_ID_PENDIENTE}${resultado.clave}`, error: null }
      return { data: null, error: { message: resultado.error } }
    },

    from(tabla) {
      return {
        async select(columnas = '*') {
          const clave = `${PREFIJO_COPIA}${tabla}|${columnas}`
          let respuesta: { data: unknown[] | null; error: ErrorBaseDeDatos | null }
          try {
            respuesta = await cliente.from(tabla).select(columnas)
          } catch (causa) {
            if (!esErrorDeRed(causa)) throw causa
            respuesta = { data: null, error: { message: 'Failed to fetch' } }
          }
          if (respuesta.error === null) {
            guardarCopia(clave, respuesta.data ?? [])
            return respuesta
          }
          if (!esErrorDeRed(respuesta.error)) return respuesta
          const copia = leerCopia(clave)
          if (copia !== null) return { data: copia, error: null }
          return { data: null, error: { message: 'Sin conexión: todavía no hay datos guardados en este teléfono' } }
        },
      }
    },

    limpiarCache() {
      for (const clave of almacen.claves()) {
        if (clave.startsWith(PREFIJO_COPIA)) almacen.borrar(clave)
      }
    },
  }
}
