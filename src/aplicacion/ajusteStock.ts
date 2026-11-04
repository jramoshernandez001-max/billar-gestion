/**
 * Cálculo de un ajuste de stock (conteo físico).
 *
 * Qué hace: calcula el stock que quedaría después de sumar o restar unidades,
 * las unidades con signo que se mandan a la base y qué impide guardar.
 * Cómo lo hace: exige unidades enteras mayores a cero y un motivo con texto;
 * suma o resta según el tipo.
 * Por qué: la pantalla muestra "Stock después del ajuste" antes de guardar; la
 * base exige unidades con signo distintas de cero y motivo obligatorio.
 */

/** Sentido del ajuste. */
export type TipoAjuste = 'sumar' | 'restar'

/** Datos que escribe la persona. */
export interface EntradaAjuste {
  /** Stock actual en la ubicación elegida. */
  actual: number
  tipo: TipoAjuste
  /** Unidades a sumar o restar; null mientras no se escriben. */
  unidades: number | null
  motivo: string
}

/** Resultado del cálculo. */
export interface ResultadoAjuste {
  /** Stock resultante (igual al actual si aún no hay unidades válidas). */
  despues: number
  /** Unidades con signo para la base; null si no se puede guardar por las unidades. */
  unidadesConSigno: number | null
  /** Primer problema, en lenguaje claro; null si se puede guardar. */
  problema: string | null
  puedeGuardar: boolean
}

export function calcularAjuste(entrada: EntradaAjuste): ResultadoAjuste {
  const { actual, tipo, unidades, motivo } = entrada
  const unidadesValidas = unidades !== null && Number.isInteger(unidades) && unidades > 0
  const unidadesConSigno = unidadesValidas ? (tipo === 'sumar' ? unidades : -unidades) : null
  const despues = unidadesConSigno === null ? actual : actual + unidadesConSigno
  let problema: string | null = null
  if (!unidadesValidas) problema = 'Escribe las unidades (un número entero mayor a cero)'
  else if (motivo.trim() === '') problema = 'Escribe el motivo del ajuste'
  return { despues, unidadesConSigno, problema, puedeGuardar: problema === null }
}
