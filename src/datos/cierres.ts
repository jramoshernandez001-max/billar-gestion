/**
 * Repositorio de cierres.
 *
 * Qué hace: guarda un cierre calculado, lo recalcula, corrige el dinero
 * contado y lee los cierres guardados.
 * Cómo lo hace: valida tipo, periodo y montos con las reglas del dominio,
 * llama a la función SQL con los parámetros por nombre y, al leer, convierte
 * las horas de la base a ISO UTC (formato que usa el dominio).
 * Por qué: el cálculo lo hace el dominio (cerrarDia, cerrarSemana); la base
 * solo guarda lo calculado y escribe la bitácora en la misma transacción.
 * Un cierre nunca se recalcula solo: estas funciones las llama un usuario.
 * El resultado se maneja como dato opaco: este archivo no lo interpreta.
 */
import type { CierreGuardado, TipoCierre } from '../domain/cierres/actualizacionCierre'
import type { CostoUsado } from '../domain/cierres/cierreSemanal'
import { validarSemana } from '../domain/compartido/semana'
import { validarFecha, validarMonto } from '../domain/compartido/validaciones'
import { leerFilas, llamarFuncion, type ClienteDatos } from './clienteDatos'
import { esEntero, esObjeto, exigirId, exigirIdRespuesta, exigirUnoDe } from './entradas'

const TIPOS: readonly TipoCierre[] = ['diario', 'semanal']

/** Datos para guardar un cierre recién calculado. */
export interface DatosGuardarCierreBd {
  tipo: TipoCierre
  desde: string
  hasta: string
  efectivo: number
  transferencias: number
  /** Costo manual por unidad, por id de producto, en pesos. */
  costosManuales?: Record<string, number>
  costosUsados: readonly CostoUsado[]
  resultado: unknown
}

/** Un cierre leído de la base, con su id. */
export type CierreLeido = CierreGuardado<unknown> & {
  id: string
  /** Costo manual por unidad, por id de producto, con el que se calculó. */
  costosManuales: Record<string, number>
}

/** Operaciones de cierres. */
export interface RepositorioCierres {
  guardarCierre(datos: DatosGuardarCierreBd): Promise<string>
  recalcularCierre(cierreId: string, costosUsados: readonly CostoUsado[], resultado: unknown): Promise<void>
  corregirDineroCierre(cierreId: string, efectivo: number, transferencias: number): Promise<void>
  listarCierres(): Promise<CierreLeido[]>
}

/**
 * Valida el periodo según el tipo de cierre.
 *
 * Qué hace: lanza un error si el periodo no corresponde al tipo.
 * Cómo lo hace: el diario debe ser de un solo día; el semanal, de lunes a
 * domingo (validarSemana).
 * Por qué: la base lo exige igual; avisar antes da un mensaje más claro.
 */
function validarPeriodo(tipo: TipoCierre, desde: string, hasta: string): void {
  validarFecha('El inicio del cierre', desde)
  validarFecha('El fin del cierre', hasta)
  if (tipo === 'semanal') {
    validarSemana(desde, hasta)
  } else if (desde !== hasta) {
    throw new Error('El cierre diario debe ser de un solo día')
  }
}

/** Valida los costos manuales (monto por unidad de cada producto). */
function validarCostosManuales(costos: Record<string, number>): Record<string, number> {
  for (const [productoId, costo] of Object.entries(costos)) {
    exigirId('El producto del costo manual', productoId)
    validarMonto('El costo manual', costo)
  }
  return costos
}

/** Convierte una hora de la base a ISO UTC; null si no es una hora válida. */
function aIsoUtc(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString()
}

/**
 * Convierte una fila de `cierres` a CierreLeido.
 *
 * Qué hace: devuelve el cierre con los nombres y formatos del dominio.
 * Cómo lo hace: revisa cada campo y normaliza las horas.
 * Por qué: una fila rara se detecta aquí y no en un cálculo posterior.
 */
function filaACierre(fila: unknown): CierreLeido {
  const mala = () => new Error('Una fila de cierres no tiene la forma esperada')
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    (fila.tipo !== 'diario' && fila.tipo !== 'semanal') ||
    typeof fila.desde !== 'string' ||
    typeof fila.hasta !== 'string' ||
    !esEntero(fila.efectivo) ||
    !esEntero(fila.transferencias) ||
    !Array.isArray(fila.costos_usados) ||
    !esObjeto(fila.costos_manuales) ||
    !esObjeto(fila.resultado)
  ) {
    throw mala()
  }
  const calculadoEn = aIsoUtc(fila.calculado_en)
  const dineroCorregidoEn = fila.dinero_corregido_en === null ? null : aIsoUtc(fila.dinero_corregido_en)
  if (calculadoEn === null || (fila.dinero_corregido_en !== null && dineroCorregidoEn === null)) throw mala()
  return {
    id: fila.id,
    tipo: fila.tipo,
    desde: fila.desde,
    hasta: fila.hasta,
    efectivo: fila.efectivo,
    transferencias: fila.transferencias,
    calculadoEn,
    dineroCorregidoEn,
    costosManuales: fila.costos_manuales as Record<string, number>,
    costosUsados: fila.costos_usados as CostoUsado[],
    resultado: fila.resultado,
  }
}

/**
 * Crea el repositorio de cierres.
 *
 * Qué hace: devuelve las operaciones sobre un cliente de datos.
 * Cómo lo hace: cierra sobre el cliente.
 * Por qué: recibirlo por parámetro permite probar sin Supabase.
 */
export function crearRepositorioCierres(cliente: ClienteDatos): RepositorioCierres {
  return {
    async guardarCierre(datos) {
      const tipo = exigirUnoDe('El tipo de cierre', datos.tipo, TIPOS)
      validarPeriodo(tipo, datos.desde, datos.hasta)
      validarMonto('El efectivo', datos.efectivo)
      validarMonto('Las transferencias', datos.transferencias)
      const id = await llamarFuncion(cliente, 'guardar_cierre', {
        p_tipo: tipo,
        p_desde: datos.desde,
        p_hasta: datos.hasta,
        p_efectivo: datos.efectivo,
        p_transferencias: datos.transferencias,
        p_costos_manuales: validarCostosManuales(datos.costosManuales ?? {}),
        p_costos_usados: datos.costosUsados,
        p_resultado: datos.resultado,
      })
      return exigirIdRespuesta(id)
    },

    async recalcularCierre(cierreId, costosUsados, resultado) {
      await llamarFuncion(cliente, 'recalcular_cierre', {
        p_cierre_id: exigirId('El cierre', cierreId),
        p_costos_usados: costosUsados,
        p_resultado: resultado,
      })
    },

    async corregirDineroCierre(cierreId, efectivo, transferencias) {
      validarMonto('El efectivo', efectivo)
      validarMonto('Las transferencias', transferencias)
      await llamarFuncion(cliente, 'corregir_dinero_cierre', {
        p_cierre_id: exigirId('El cierre', cierreId),
        p_efectivo: efectivo,
        p_transferencias: transferencias,
      })
    },

    async listarCierres() {
      const filas = await leerFilas(
        cliente,
        'cierres',
        'id, tipo, desde, hasta, efectivo, transferencias, calculado_en, dinero_corregido_en, costos_manuales, costos_usados, resultado',
      )
      return filas.map(filaACierre)
    },
  }
}
