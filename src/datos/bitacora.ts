/**
 * Repositorio de bitácora (solo lectura).
 *
 * Qué hace: lee la bitácora de cambios y la entrega con los tipos de la app.
 * Cómo lo hace: lee la tabla `bitacora`, revisa cada columna, exige que la
 * acción esté en la lista fija del dominio y convierte la hora a ISO UTC.
 * Por qué: la app nunca escribe en la bitácora (lo hacen las funciones de la
 * base en la misma transacción que cada cambio); aquí solo se consulta, por
 * ejemplo para saber qué cierres quedaron desactualizados.
 */
import { esAccionBitacora, type AccionBitacora } from '../domain/compartido/bitacora'
import { leerFilas, type ClienteDatos } from './clienteDatos'
import { esObjeto } from './entradas'

/** Una entrada de la bitácora. */
export interface EntradaBitacora {
  id: string
  /** Cuándo ocurrió, en ISO 8601 UTC. */
  momento: string
  /** Correo de quien lo hizo. */
  usuario: string
  accion: AccionBitacora
  /** Tabla afectada; null en acciones sin un registro único. */
  tabla: string | null
  registroId: string | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown>
  motivo: string | null
}

/** Operaciones de lectura de la bitácora. */
export interface RepositorioBitacora {
  listarBitacora(): Promise<EntradaBitacora[]>
}

/** Texto o null; cualquier otra cosa es una fila mal formada. */
function textoONulo(valor: unknown): string | null | undefined {
  return valor === null || typeof valor === 'string' ? valor : undefined
}

/** Convierte una fila de `bitacora` a EntradaBitacora. */
function filaAEntrada(fila: unknown): EntradaBitacora {
  const mala = () => new Error('Una fila de la bitácora no tiene la forma esperada')
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    typeof fila.momento !== 'string' ||
    typeof fila.usuario !== 'string' ||
    typeof fila.accion !== 'string' ||
    !esAccionBitacora(fila.accion) ||
    !esObjeto(fila.despues) ||
    (fila.antes !== null && !esObjeto(fila.antes))
  ) {
    throw mala()
  }
  const momento = new Date(fila.momento)
  const tabla = textoONulo(fila.tabla)
  const registroId = textoONulo(fila.registro_id)
  const motivo = textoONulo(fila.motivo)
  if (Number.isNaN(momento.getTime()) || tabla === undefined || registroId === undefined || motivo === undefined) {
    throw mala()
  }
  return {
    id: fila.id,
    momento: momento.toISOString(),
    usuario: fila.usuario,
    accion: fila.accion,
    tabla,
    registroId,
    antes: fila.antes,
    despues: fila.despues,
    motivo,
  }
}

/** Crea el repositorio de bitácora sobre un cliente de datos. */
export function crearRepositorioBitacora(cliente: ClienteDatos): RepositorioBitacora {
  return {
    async listarBitacora() {
      const filas = await leerFilas(cliente, 'bitacora', 'id, momento, usuario, accion, tabla, registro_id, antes, despues, motivo')
      return filas.map(filaAEntrada)
    },
  }
}
