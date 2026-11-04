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
