/**
 * Semana del cierre semanal.
 *
 * Qué hace: valida el periodo de un cierre semanal (cualquier rango, sin
 * fin antes del inicio), propone la semana de martes a lunes, dice si dos
 * periodos se cruzan y ofrece ayudas de fechas: sumar días y día de la
 * semana.
 * Cómo lo hace: funciones puras que convierten el texto AAAA-MM-DD en un
 * instante a medianoche UTC y usan solo métodos UTC (getUTCDay,
 * setUTCDate), así el resultado no depende de la zona horaria del equipo.
 * Por qué: el negocio cierra la semana los martes (ventas de martes a lunes)
 * y a veces elige otro rango. Con la hora local, un celular en otra zona
 * podría ver otro día de la semana.
 */
import { validarFecha } from './validaciones'

/** Un día en milisegundos; en UTC todos los días duran lo mismo. */
const MS_POR_DIA = 24 * 60 * 60 * 1000

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
 * Por qué: la semana propuesta se arma restando días, y hay que
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
 * Por qué: la semana del negocio termina el lunes; numerarla así
 * hace más claras las comparaciones.
 *
 * @throws Error si la fecha es inválida.
 */
export function diaDeLaSemana(fecha: string): number {
  const dia = aMedianocheUtc('La fecha', fecha).getUTCDay()
  return dia === 0 ? 7 : dia
}

/** Un periodo de fechas AAAA-MM-DD, con ambos extremos incluidos. */
export interface Periodo {
  desde: string
  hasta: string
}

/** Día de la semana con que termina la semana del negocio (1 = lunes). */
const DIA_FIN_DE_SEMANA = 1

/**
 * Valida el periodo de un cierre semanal.
 *
 * Qué hace: lanza un error si alguna fecha es inválida o si el fin es
 * anterior al inicio.
 * Cómo lo hace: valida ambas fechas y las compara como texto (AAAA-MM-DD
 * ordena igual que el calendario).
 * Por qué: el usuario elige de qué fecha a qué fecha cierra; puede ser de
 * cualquier largo y empezar cualquier día, pero no al revés.
 *
 * @throws Error si una fecha es inválida o si `hasta` es anterior a `desde`.
 */
export function validarPeriodoSemanal(desde: string, hasta: string): void {
  validarFecha('La fecha de inicio del cierre semanal', desde)
  validarFecha('La fecha de fin del cierre semanal', hasta)
  if (hasta < desde) {
    throw new Error('La fecha de fin del cierre semanal no puede ser anterior a la de inicio')
  }
}

/**
 * Propone la semana a cerrar.
 *
 * Qué hace: devuelve la última semana completa de martes a lunes antes de
 * hoy.
 * Cómo lo hace: retrocede desde hoy hasta el lunes anterior (si hoy es
 * lunes, el de la semana pasada, porque hoy todavía se vende) y toma los 6
 * días anteriores a ese lunes.
 * Por qué: el negocio cierra la semana los martes, con las ventas de martes
 * a lunes. El usuario puede cambiar las fechas si necesita otro rango.
 *
 * @throws Error si la fecha es inválida.
 */
export function semanaPorDefecto(hoy: string): Periodo {
  const diasAtras = ((diaDeLaSemana(hoy) - DIA_FIN_DE_SEMANA - 1 + 7) % 7) + 1
  const hasta = sumarDias(hoy, -diasAtras)
  return { desde: sumarDias(hasta, -6), hasta }
}

/**
 * Dice si dos periodos comparten al menos un día.
 *
 * Qué hace: true si se cruzan, false si uno termina antes de que empiece el
 * otro.
 * Cómo lo hace: compara los extremos como texto AAAA-MM-DD.
 * Por qué: dos cierres semanales no pueden contar las mismas ventas.
 */
export function periodosSeCruzan(a: Periodo, b: Periodo): boolean {
  return a.desde <= b.hasta && b.desde <= a.hasta
}
