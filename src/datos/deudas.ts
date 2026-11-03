/**
 * Repositorio de deudas y abonos.
 *
 * Qué hace: registra y anula deudas y abonos, y lee ambas listas.
 * Cómo lo hace: valida los datos con las reglas del dominio (monto mayor a
 * cero, descripción normalizada y de máximo 200 caracteres), llama a la
 * función SQL con los parámetros por nombre y convierte las filas leídas.
 * Por qué: cada deuda y abono debe quedar justificado; la base escribe la
 * bitácora y rechaza un abono mayor a lo que se debe. Aquí se avisa antes de
 * ir a la base cuando algo está mal escrito.
 */
import type { Abono, Deuda } from '../domain/deudas/deudas'
import { normalizarDescripcion, validarDescripcion } from '../domain/deudas/descripcion'
import { validarFecha } from '../domain/compartido/validaciones'
import { leerFilas, llamarFuncion, type ClienteDatos } from './clienteDatos'
import { esEntero, esObjeto, exigirEnteroPositivo, exigirId, exigirIdRespuesta, exigirTexto } from './entradas'

/** Datos para registrar una deuda. */
export interface DatosDeuda {
  cliente: string
  /** Día en que nació la deuda, AAAA-MM-DD. */
  fecha: string
  /** Pesos, entero mayor a cero. */
  monto: number
  descripcion: string
}

/** Datos para registrar un abono. */
export interface DatosAbono {
  deudaId: string
  fecha: string
  monto: number
  descripcion: string
}

/** Operaciones de deudas y abonos. */
export interface RepositorioDeudas {
  registrarDeuda(datos: DatosDeuda): Promise<string>
  anularDeuda(deudaId: string, motivo: string): Promise<void>
  registrarAbono(datos: DatosAbono): Promise<string>
  anularAbono(abonoId: string, motivo: string): Promise<void>
  listarDeudas(): Promise<Deuda[]>
  listarAbonos(): Promise<Abono[]>
}

/**
 * Normaliza y valida la descripción de una deuda o abono.
 *
 * Qué hace: devuelve la descripción limpia.
 * Cómo lo hace: quita espacios de los lados, reduce los grupos de blancos a
 * uno y aplica la validación del dominio (no vacía, máximo 200).
 * Por qué: es la misma regla que aplica la base; así el usuario ve el error
 * sin esperar la respuesta.
 */
function descripcionLimpia(descripcion: string): string {
  const limpia = normalizarDescripcion(descripcion)
  validarDescripcion('La descripción', limpia)
  return limpia
}

/** Exige un monto entero mayor a cero (deudas y abonos nunca son cero). */
function montoPositivo(nombre: string, monto: number): number {
  return exigirEnteroPositivo(nombre, monto)
}

/** Estado válido de un registro. */
function esEstado(valor: unknown): valor is 'vigente' | 'anulada' {
  return valor === 'vigente' || valor === 'anulada'
}

/** Convierte una fila de `deudas` a Deuda. */
function filaADeuda(fila: unknown): Deuda {
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    typeof fila.cliente !== 'string' ||
    typeof fila.fecha !== 'string' ||
    !esEntero(fila.monto) ||
    typeof fila.descripcion !== 'string' ||
    !esEstado(fila.estado)
  ) {
    throw new Error('Una fila de deudas no tiene la forma esperada')
  }
  return {
    id: fila.id,
    cliente: fila.cliente,
    fecha: fila.fecha,
    monto: fila.monto,
    descripcion: fila.descripcion,
    estado: fila.estado,
  }
}

/** Convierte una fila de `abonos_deuda` a Abono. */
function filaAAbono(fila: unknown): Abono {
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    typeof fila.deuda_id !== 'string' ||
    typeof fila.fecha !== 'string' ||
    !esEntero(fila.monto) ||
    typeof fila.descripcion !== 'string' ||
    !esEstado(fila.estado)
  ) {
    throw new Error('Una fila de abonos no tiene la forma esperada')
  }
  return {
    id: fila.id,
    deudaId: fila.deuda_id,
    fecha: fila.fecha,
    monto: fila.monto,
    descripcion: fila.descripcion,
    estado: fila.estado,
  }
}

/**
 * Crea el repositorio de deudas y abonos.
 *
 * Qué hace: devuelve las operaciones sobre un cliente de datos.
 * Cómo lo hace: cierra sobre el cliente.
 * Por qué: recibirlo por parámetro permite probar sin Supabase.
 */
export function crearRepositorioDeudas(cliente: ClienteDatos): RepositorioDeudas {
  return {
    async registrarDeuda(datos) {
      validarFecha('La fecha de la deuda', datos.fecha)
      const id = await llamarFuncion(cliente, 'registrar_deuda', {
        p_cliente: exigirTexto('El cliente', datos.cliente).replace(/\s+/g, ' '),
        p_fecha: datos.fecha,
        p_monto: montoPositivo('El monto de la deuda', datos.monto),
        p_descripcion: descripcionLimpia(datos.descripcion),
      })
      return exigirIdRespuesta(id)
    },

    async anularDeuda(deudaId, motivo) {
      await llamarFuncion(cliente, 'anular_deuda', {
        p_deuda_id: exigirId('La deuda', deudaId),
        p_motivo: exigirTexto('El motivo', motivo),
      })
    },

    async registrarAbono(datos) {
      validarFecha('La fecha del abono', datos.fecha)
      const id = await llamarFuncion(cliente, 'registrar_abono', {
        p_deuda_id: exigirId('La deuda', datos.deudaId),
        p_fecha: datos.fecha,
        p_monto: montoPositivo('El monto del abono', datos.monto),
        p_descripcion: descripcionLimpia(datos.descripcion),
      })
      return exigirIdRespuesta(id)
    },

    async anularAbono(abonoId, motivo) {
      await llamarFuncion(cliente, 'anular_abono', {
        p_abono_id: exigirId('El abono', abonoId),
        p_motivo: exigirTexto('El motivo', motivo),
      })
    },

    async listarDeudas() {
      const filas = await leerFilas(cliente, 'deudas', 'id, cliente, fecha, monto, descripcion, estado')
      return filas.map(filaADeuda)
    },

    async listarAbonos() {
      const filas = await leerFilas(cliente, 'abonos_deuda', 'id, deuda_id, fecha, monto, descripcion, estado')
      return filas.map(filaAAbono)
    },
  }
}
