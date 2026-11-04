/**
 * Vista de un cierre para las pantallas.
 *
 * Qué hace: convierte el resultado de un cierre (guardado como datos sueltos)
 * en lo que se muestra: lo vendido, el dinero, las deudas, si cuadra, falta o
 * sobra, y en el semanal la utilidad, lo vendido sin costo y los productos
 * sin costo con su nombre.
 * Cómo lo hace: revisa la forma del resultado según el tipo y deduce lo que
 * no se guarda (lo vendido = dinero total − diferencia; las deudas = dinero
 * total − efectivo − transferencias).
 * Por qué: el resultado se guarda en la base como JSON; las pantallas no
 * deben interpretarlo ni calcular. Si no tiene la forma esperada es un error
 * claro, no un número inventado.
 */
import type { ResultadoCuadre } from '../domain/cierres/cuadreCierre'
import { esObjeto } from '../datos/entradas'

export type EstadoCuadre = 'cuadra' | 'faltante' | 'sobrante'

/** Parte propia del cierre semanal. */
export interface VistaSemanal {
  completo: boolean
  costoReposicion: number
  utilidadEsperada: number
  /** null si el cierre está incompleto: no se calcula utilidad real. */
  utilidadReal: number | null
  diferenciaUtilidad: number | null
  ventasSinCosto: number
  productosSinCosto: { id: string; nombre: string }[]
  /** Cuántas compras se usaron como costo. */
  comprasUsadas: number
}

export interface VistaCierre {
  vendido: number
  dineroTotal: number
  efectivo: number
  transferencias: number
  deudas: number
  estado: EstadoCuadre
  /** Faltante o sobrante en pesos; cero si cuadra exacto. */
  monto: number
  semanal: VistaSemanal | null
}

const malo = () => new Error('El resultado del cierre no tiene la forma esperada')

/** Revisa que un valor sea un entero (pueden ser negativos: diferencias). */
function entero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) throw malo()
  return valor
}

/** Lee un ResultadoCuadre guardado. */
function leerCuadre(valor: unknown): ResultadoCuadre {
  if (!esObjeto(valor) || typeof valor.cuadra !== 'boolean') throw malo()
  return {
    dineroTotal: entero(valor.dineroTotal),
    diferencia: entero(valor.diferencia),
    cuadra: valor.cuadra,
    faltante: entero(valor.faltante),
    sobrante: entero(valor.sobrante),
  }
}

/** Lee la parte semanal de un resultado. */
function leerSemanal(resultado: Record<string, unknown>, nombres: ReadonlyMap<string, string>): VistaSemanal {
  if (typeof resultado.completo !== 'boolean' || !Array.isArray(resultado.productosSinCosto) || !Array.isArray(resultado.comprasUsadas)) throw malo()
  const productosSinCosto = resultado.productosSinCosto.map((id) => {
    if (typeof id !== 'string') throw malo()
    return { id, nombre: nombres.get(id) ?? 'Producto' }
  })
  const comun = {
    completo: resultado.completo,
    costoReposicion: entero(resultado.costoReposicion),
    ventasSinCosto: entero(resultado.ventasSinCosto),
    productosSinCosto,
    comprasUsadas: resultado.comprasUsadas.length,
  }
  if (resultado.completo) {
    const u = resultado.utilidad
    if (!esObjeto(u)) throw malo()
    return { ...comun, utilidadEsperada: entero(u.utilidadEsperada), utilidadReal: entero(u.utilidadReal), diferenciaUtilidad: entero(u.diferencia) }
  }
  return { ...comun, utilidadEsperada: entero(resultado.utilidadEsperada), utilidadReal: null, diferenciaUtilidad: null }
}

export function describirCierre(
  tipo: 'diario' | 'semanal',
  resultado: unknown,
  dinero: { efectivo: number; transferencias: number },
  nombres: ReadonlyMap<string, string>,
): VistaCierre {
  if (!esObjeto(resultado)) throw malo()
  const cuadre = leerCuadre(tipo === 'diario' ? resultado : resultado.cuadre)
  return {
    vendido: cuadre.dineroTotal - cuadre.diferencia,
    dineroTotal: cuadre.dineroTotal,
    efectivo: dinero.efectivo,
    transferencias: dinero.transferencias,
    deudas: cuadre.dineroTotal - dinero.efectivo - dinero.transferencias,
    estado: cuadre.faltante > 0 ? 'faltante' : cuadre.sobrante > 0 ? 'sobrante' : 'cuadra',
    monto: cuadre.faltante > 0 ? cuadre.faltante : cuadre.sobrante,
    semanal: tipo === 'semanal' ? leerSemanal(resultado, nombres) : null,
  }
}
