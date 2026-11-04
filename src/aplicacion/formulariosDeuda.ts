/**
 * Validación de los formularios de deuda y de abono.
 *
 * Qué hace: revisa lo que escribe la persona (cliente, monto, descripción) y
 * devuelve los datos para el repositorio o un mensaje por campo; el abono
 * además no puede superar el saldo.
 * Cómo lo hace: normaliza la descripción con el dominio (espacios de los
 * lados fuera, grupos de espacios en uno) y comprueba monto entero mayor a
 * cero y largo máximo.
 * Por qué: la base rechaza un abono mayor a la deuda y una descripción vacía;
 * avisar antes, junto al campo, es mejor que un error al guardar. La base
 * sigue siendo la que manda.
 */
import type { DatosAbono, DatosDeuda } from '../datos/deudas'
import { normalizarDescripcion } from '../domain/deudas/descripcion'
import { formatoPesos } from '../interfaz/formato'

export interface Resultado<T, C extends string> {
  datos: T | null
  errores: Partial<Record<C, string>>
  puedeGuardar: boolean
}

/** Lo escrito para una deuda. */
export interface EntradaDeuda { cliente: string; monto: string; descripcion: string }
/** Lo escrito para un abono. */
export interface EntradaAbono { monto: string; descripcion: string }

/** Entero mayor a cero o null. */
function montoEntero(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null
  const n = Number(texto)
  return n > 0 ? n : null
}

/** Descripción limpia o el mensaje del dominio si no se puede usar. */
function limpiarDescripcion(texto: string): { valor: string; error?: string } {
  try {
    return { valor: normalizarDescripcion(texto) }
  } catch (causa) {
    return { valor: '', error: causa instanceof Error ? causa.message : String(causa) }
  }
}

export function validarDeuda(entrada: EntradaDeuda, fecha: string): Resultado<DatosDeuda, keyof EntradaDeuda> {
  const errores: Partial<Record<keyof EntradaDeuda, string>> = {}
  const cliente = entrada.cliente.trim().replace(/\s+/g, ' ')
  if (cliente === '') errores.cliente = 'Escribe el nombre del cliente'
  const monto = montoEntero(entrada.monto)
  if (monto === null) errores.monto = 'Escribe un monto en pesos mayor a cero'
  const { valor: descripcion, error: errDescripcion } = limpiarDescripcion(entrada.descripcion)
  if (errDescripcion !== undefined) errores.descripcion = errDescripcion
  if (Object.keys(errores).length > 0 || monto === null) return { datos: null, errores, puedeGuardar: false }
  return { datos: { cliente, fecha, monto, descripcion }, errores: {}, puedeGuardar: true }
}

export function validarAbono(
  entrada: EntradaAbono,
  deudaId: string,
  saldo: number,
  fecha: string,
): Resultado<DatosAbono, keyof EntradaAbono> {
  const errores: Partial<Record<keyof EntradaAbono, string>> = {}
  const monto = montoEntero(entrada.monto)
  if (monto === null) errores.monto = 'Escribe un monto en pesos mayor a cero'
  else if (monto > saldo) errores.monto = `El abono supera lo que se debe (${formatoPesos(saldo)})`
  const { valor: descripcion, error: errDescripcion } = limpiarDescripcion(entrada.descripcion)
  if (errDescripcion !== undefined) errores.descripcion = errDescripcion
  if (Object.keys(errores).length > 0 || monto === null) return { datos: null, errores, puedeGuardar: false }
  return { datos: { deudaId, fecha, monto, descripcion }, errores: {}, puedeGuardar: true }
}
