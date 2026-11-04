/**
 * Semana del cierre semanal.
 *
 * Qué hace: valida que el periodo de un cierre semanal vaya de un lunes al
 * domingo siguiente (exactamente 7 días), y ofrece dos ayudas de fechas:
 * sumar días y saber qué día de la semana es.
 * Cómo lo hace: funciones puras que convierten el texto AAAA-MM-DD en un
 * instante a medianoche UTC y usan solo métodos UTC (getUTCDay,
 * setUTCDate), así el resultado no depende de la zona horaria del equipo.
 * Por qué: el negocio cierra la semana de lunes a domingo. Si cada semana
 * cubriera días distintos, las utilidades no se podrían comparar. Con la
 * hora local, un celular en otra zona podría ver otro día de la semana.
 */
import { validarFecha } from './validaciones'

/** Un día en milisegundos; en UTC todos los días duran lo mismo. */
const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Días que hay del lunes al domingo de la misma semana. */
const DIAS_DEL_LUNES_AL_DOMINGO = 6

/**
 * Convierte una fecha AAAA-MM-DD en su instante a medianoche UTC.
 *
 * Qué hace: devuelve el Date de ese día a las 00:00 UTC.
 * Cómo lo hace: valida la fecha y la arma con el sufijo Z (UTC).
 * Por qué: sin la Z, JavaScript podría interpretar la hora local.
 */
function aMedianocheUtc(nombre: string, fecha: string): Date {
  validarFecha(nombre, fecha)
  return new Date(`${fecha}T00:00:00Z`)
}

/**
 * Suma días a una fecha.
 *
 * Qué hace: devuelve la fecha AAAA-MM-DD que queda `dias` después (o antes,
 * si es negativo).
 * Cómo lo hace: suma milisegundos de días completos al instante UTC y
 * vuelve a texto; en UTC no hay cambios de horario que corran el día.
 * Por qué: el fin de la semana es el lunes más seis días, y hay que
 * calcularlo bien al cruzar de mes, de año o un 29 de febrero.
 *
 * @throws Error si la fecha es inválida o los días no son un entero.
 */
export function sumarDias(fecha: string, dias: number): string {
  if (!Number.isInteger(dias)) {
    throw new Error('Los días a sumar deben ser un entero')
  }
  const instante = aMedianocheUtc('La fecha', fecha)
  return new Date(instante.getTime() + dias * MS_POR_DIA).toISOString().slice(0, 10)
}

/**
 * Dice qué día de la semana es una fecha.
 *
 * Qué hace: devuelve 1 para lunes, 2 para martes… y 7 para domingo.
 * Cómo lo hace: usa getUTCDay (0 es domingo) y pasa el domingo a 7.
 * Por qué: el negocio cierra la semana de lunes a domingo; numerarla así
 * hace más claras las comparaciones.
 *
 * @throws Error si la fecha es inválida.
 */
export function diaDeLaSemana(fecha: string): number {
  const dia = aMedianocheUtc('La fecha', fecha).getUTCDay()
  return dia === 0 ? 7 : dia
}

/**
 * Valida que un periodo sea una semana de cierre de lunes a domingo.
 *
 * Qué hace: lanza un error si `desde` no es lunes o si `hasta` no es el
 * domingo siguiente (6 días después).
 * Cómo lo hace: valida ambas fechas, revisa el día de la semana de `desde`
 * y compara `hasta` con `desde` más seis días.
 * Por qué: la semana debe tener exactamente 7 días y empezar en lunes.
 * Comparar con el lunes más seis días cubre a la vez que `hasta` sea
 * domingo, que sea de esa misma semana y que no sea anterior a `desde`.
 *
 * @throws Error si alguna fecha es inválida, si `desde` no es lunes o si
 * `hasta` no es el domingo siguiente.
 */
export function validarSemana(desde: string, hasta: string): void {
  validarFecha('La fecha de inicio de la semana', desde)
  validarFecha('La fecha de fin de la semana', hasta)
  if (diaDeLaSemana(desde) !== 1) {
    throw new Error('La semana de cierre debe empezar un lunes')
  }
  if (hasta !== sumarDias(desde, DIAS_DEL_LUNES_AL_DOMINGO)) {
    throw new Error('La semana de cierre debe terminar el domingo siguiente al lunes de inicio')
  }
}

/**
 * Devuelve el lunes de la semana de una fecha.
 *
 * Qué hace: la fecha misma si es lunes; si no, el lunes anterior.
 * Cómo lo hace: resta (día de la semana - 1) días con sumarDias.
 * Por qué: el cierre semanal empieza siempre en lunes; con esto la pantalla
 * ofrece la semana que contiene el día elegido.
 *
 * @throws Error si la fecha es inválida.
 */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -(diaDeLaSemana(fecha) - 1))
}
