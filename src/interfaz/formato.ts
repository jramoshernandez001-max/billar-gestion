/**
 * Formato de textos de la interfaz.
 *
 * Qué hace: convierte dinero y fechas a los textos que muestra el diseño
 * ("$ 150.000", "Martes, 3 de noviembre", "28 oct – 3 nov", "02/11").
 * Cómo lo hace: funciones puras con listas fijas de nombres en español y
 * fechas calculadas en UTC.
 * Por qué: el formato debe ser idéntico en todas las pantallas y no depender
 * de la configuración regional del navegador ni de la zona horaria. Las
 * fechas internas siguen siendo texto AAAA-MM-DD.
 */
import { diaDeLaSemana } from '../domain/compartido/semana'
import { validarFecha } from '../domain/compartido/validaciones'

const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Parte una fecha AAAA-MM-DD en año, mes (1-12) y día, validándola. */
function partes(fecha: string): { anio: number; mes: number; dia: number } {
  validarFecha('La fecha', fecha)
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

/** Dice el día de la semana como índice 0 (lunes) a 6 (domingo). */
function indiceDia(fecha: string): number {
  return diaDeLaSemana(fecha) - 1
}

/**
 * Da formato de pesos: "$ 150.000" (negativos: "-$ 65.000").
 * @throws Error si el valor no es un entero.
 */
export function formatoPesos(valor: number): string {
  if (!Number.isInteger(valor)) throw new Error('El dinero debe ser un entero en pesos')
  const digitos = String(Math.abs(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${valor < 0 ? '-' : ''}$ ${digitos}`
}

/** "Martes, 3 de noviembre". */
export function fechaLarga(fecha: string): string {
  const { mes, dia } = partes(fecha)
  return `${DIAS_LARGOS[indiceDia(fecha)]}, ${dia} de ${MESES[mes - 1]}`
}

/** "03/11/2026" (día/mes/año). */
export function fechaCompleta(fecha: string): string {
  const { anio } = partes(fecha)
  return `${fechaCorta(fecha)}/${anio}`
}

/** "02/11" (día/mes). */
export function fechaCorta(fecha: string): string {
  const { mes, dia } = partes(fecha)
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

/** "28 oct – 3 nov". */
export function rangoCorto(desde: string, hasta: string): string {
  const abreviado = (fecha: string) => {
    const { mes, dia } = partes(fecha)
    return `${dia} ${MESES[mes - 1].slice(0, 3)}`
  }
  return `${abreviado(desde)} – ${abreviado(hasta)}`
}

/** "Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do". */
export function diaSemanaCorto(fecha: string): string {
  partes(fecha)
  return DIAS_CORTOS[indiceDia(fecha)]
}

/**
 * Fecha de un instante en el día local (no UTC), como AAAA-MM-DD.
 * Por qué: "hoy" para quien usa la app es el día de su reloj; con UTC, una
 * venta de las 8 p. m. caería en el día siguiente.
 */
export function fechaLocalIso(instante: Date): string {
  const mes = String(instante.getMonth() + 1).padStart(2, '0')
  const dia = String(instante.getDate()).padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}

/**
 * Hora local de un instante ISO, como "16:20".
 *
 * Qué hace: devuelve horas y minutos con dos dígitos.
 * Cómo lo hace: lee la hora del reloj de quien usa la app (no UTC).
 * Por qué: la venta de las 4:20 p. m. debe verse a esa hora, no a la de UTC.
 * @throws Error si el texto no es un instante válido.
 */
export function horaLocal(instanteIso: string): string {
  const instante = new Date(instanteIso)
  if (Number.isNaN(instante.getTime())) throw new Error(`El instante "${instanteIso}" no es válido`)
  return `${String(instante.getHours()).padStart(2, '0')}:${String(instante.getMinutes()).padStart(2, '0')}`
}

/** Singular o plural: pluralizar(2, 'caja', 'cajas') → "2 cajas". */
function pluralizar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Dice un total de unidades como cajas, sixpacks y sueltas.
 *
 * Qué hace: "1 caja · 2 sixpacks · 3 sueltas"; omite lo que está en cero.
 * Cómo lo hace: arma una pieza por cada cantidad mayor a cero y las une.
 * Por qué: el stock va en unidades, pero se entiende mejor en las
 * presentaciones con las que se compra y se vende.
 */
export function describirEquivalente(equivalente: { cajas: number; sixpacks: number; sueltas: number }): string {
  const piezas = [
    equivalente.cajas > 0 ? pluralizar(equivalente.cajas, 'caja', 'cajas') : null,
    equivalente.sixpacks > 0 ? pluralizar(equivalente.sixpacks, 'sixpack', 'sixpacks') : null,
    equivalente.sueltas > 0 ? pluralizar(equivalente.sueltas, 'suelta', 'sueltas') : null,
  ].filter((pieza) => pieza !== null)
  return piezas.length === 0 ? 'Sin existencias' : piezas.join(' · ')
}

/** "18 unidades", "1 unidad" o "−2 unidades" (con el signo menos tipográfico). */
export function textoUnidades(n: number): string {
  return `${n < 0 ? '−' : ''}${pluralizar(Math.abs(n), 'unidad', 'unidades')}`
}

/**
 * Fecha y hora local de un instante ISO, como "03/11 · 14:05".
 *
 * Qué hace: junta la fecha corta y la hora local.
 * Cómo lo hace: usa fechaLocalIso, fechaCorta y horaLocal.
 * Por qué: la bitácora y su detalle muestran el momento igual en ambas.
 */
export function momentoLocal(instanteIso: string): string {
  return `${fechaCorta(fechaLocalIso(new Date(instanteIso)))} · ${horaLocal(instanteIso)}`
}
