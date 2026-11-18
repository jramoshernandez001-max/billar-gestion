/**
 * Cruces entre cierres semanales.
 *
 * Qué hace: rechaza un periodo semanal nuevo que comparta días con otro
 * cierre semanal ya guardado.
 * Cómo lo hace: recorre los cierres, deja solo los semanales y usa
 * periodosSeCruzan; si encuentra uno, lanza un error que dice cuál es.
 * Por qué: el usuario elige las fechas del cierre semanal a mano. Si dos
 * cierres contaran los mismos días, la plata y la utilidad se contarían dos
 * veces. Los cierres diarios no cuentan: cada día tiene el suyo.
 */
import { periodosSeCruzan, type Periodo } from '../compartido/semana'

/** Lo mínimo que se necesita de un cierre guardado. */
export interface CierreConPeriodo extends Periodo {
  tipo: 'diario' | 'semanal'
}

/**
 * Valida que un periodo semanal no se cruce con otro cierre semanal.
 *
 * Qué hace: no devuelve nada si no hay cruce; si lo hay, lanza un error.
 * Cómo lo hace: busca el primer cierre semanal que comparta al menos un día.
 * Por qué: el aviso dice las fechas del cierre que estorba, para que el
 * usuario sepa qué rango elegir.
 *
 * @throws Error si el periodo se cruza con un cierre semanal guardado.
 */
export function validarSinCruceSemanal(periodo: Periodo, cierres: readonly CierreConPeriodo[]): void {
  const cruce = cierres.find((c) => c.tipo === 'semanal' && periodosSeCruzan(periodo, c))
  if (cruce !== undefined) {
    throw new Error(`El periodo se cruza con el cierre semanal del ${cruce.desde} al ${cruce.hasta}`)
  }
}
