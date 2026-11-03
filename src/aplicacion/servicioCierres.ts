/**
 * Servicio de cierres.
 *
 * Qué hace: calcula un cierre diario o semanal con los datos guardados, lo
 * guarda, y lo recalcula cuando un usuario lo pide.
 * Cómo lo hace: lee ventas, deudas, abonos y compras de los repositorios,
 * deja solo las ventas del periodo, llama a cerrarDia o cerrarSemana del
 * dominio y entrega el resultado al repositorio de cierres.
 * Por qué: el dominio calcula pero no sabe de la base de datos, y los
 * repositorios guardan pero no calculan; este servicio los une sin mezclar
 * sus responsabilidades. Un cierre nunca se recalcula solo: recalcular lo
 * llama un usuario, y la base deja el registro en la bitácora.
 */
import { cerrarDia } from '../domain/cierres/cierreDiario'
import { cerrarSemana, type CostoUsado } from '../domain/cierres/cierreSemanal'
import type { TipoCierre } from '../domain/cierres/actualizacionCierre'
import { sumarDias } from '../domain/compartido/semana'
import { validarFecha } from '../domain/compartido/validaciones'
import type { Venta } from '../domain/ventas/venta'
import type { RepositorioCierres } from '../datos/cierres'
import type { RepositorioDeudas } from '../datos/deudas'
import type { RepositorioInventario } from '../datos/inventario'
import type { RepositorioVentas } from '../datos/ventas'

/** Lo que el servicio necesita de cada repositorio. */
export interface DependenciasCierres {
  ventas: Pick<RepositorioVentas, 'listarVentas'>
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos'>
  inventario: Pick<RepositorioInventario, 'listarCompras'>
  cierres: Pick<RepositorioCierres, 'guardarCierre' | 'recalcularCierre' | 'listarCierres'>
}

/** Datos que captura el usuario para cerrar un periodo. */
export interface DatosCerrarPeriodo {
  tipo: TipoCierre
  /** Día del cierre diario, o lunes de la semana del cierre semanal. */
  desde: string
  efectivo: number
  transferencias: number
  /** Costo por unidad de productos vendidos sin compras (solo semanal). */
  costosManuales?: Record<string, number>
}

/** Operaciones del servicio. */
export interface ServicioCierres {
  /** Calcula y guarda un cierre; devuelve su id. */
  cerrarPeriodo(datos: DatosCerrarPeriodo): Promise<string>
  /** Vuelve a calcular un cierre guardado con los datos vigentes. */
  recalcularCierre(cierreId: string): Promise<void>
}

/** Resultado de calcular, antes de guardarlo. */
interface Calculo {
  resultado: unknown
  costosUsados: readonly CostoUsado[]
}

/** Deja solo las ventas con fecha dentro del periodo (extremos incluidos). */
function ventasDelPeriodo(ventas: readonly Venta[], desde: string, hasta: string): Venta[] {
  return ventas.filter((venta) => venta.fecha >= desde && venta.fecha <= hasta)
}

/**
 * Crea el servicio de cierres.
 *
 * Qué hace: devuelve cerrarPeriodo y recalcularCierre.
 * Cómo lo hace: cierra sobre los repositorios recibidos.
 * Por qué: recibirlos por parámetro permite probar sin base de datos.
 */
export function crearServicioCierres(dependencias: DependenciasCierres): ServicioCierres {
  /** Último día del periodo: el mismo día en el diario, +6 en el semanal. */
  function ultimoDia(tipo: TipoCierre, desde: string): string {
    validarFecha('El inicio del cierre', desde)
    return tipo === 'diario' ? desde : sumarDias(desde, 6)
  }

  /**
   * Calcula el cierre con los datos que hay hoy en la base.
   * Cómo: lee todo, filtra las ventas del periodo y llama al dominio.
   */
  async function calcular(
    tipo: TipoCierre,
    desde: string,
    hasta: string,
    efectivo: number,
    transferencias: number,
    costosManuales: Record<string, number>,
  ): Promise<Calculo> {
    const [ventas, deudas, abonos] = await Promise.all([
      dependencias.ventas.listarVentas(),
      dependencias.deudas.listarDeudas(),
      dependencias.deudas.listarAbonos(),
    ])
    const delPeriodo = ventasDelPeriodo(ventas, desde, hasta)
    if (tipo === 'diario') {
      return { resultado: cerrarDia({ fecha: desde, ventas: delPeriodo, efectivo, transferencias, deudas, abonos }), costosUsados: [] }
    }
    const compras = await dependencias.inventario.listarCompras()
    const resultado = cerrarSemana({ desde, hasta, ventas: delPeriodo, efectivo, transferencias, deudas, abonos, compras, costosManuales })
    return { resultado, costosUsados: resultado.costosUsados }
  }

  return {
    async cerrarPeriodo(datos) {
      const hasta = ultimoDia(datos.tipo, datos.desde)
      const costosManuales = datos.costosManuales ?? {}
      const { resultado, costosUsados } = await calcular(
        datos.tipo, datos.desde, hasta, datos.efectivo, datos.transferencias, costosManuales,
      )
      return dependencias.cierres.guardarCierre({
        tipo: datos.tipo,
        desde: datos.desde,
        hasta,
        efectivo: datos.efectivo,
        transferencias: datos.transferencias,
        costosManuales,
        costosUsados,
        resultado,
      })
    },

    async recalcularCierre(cierreId) {
      const cierres = await dependencias.cierres.listarCierres()
      const cierre = cierres.find((c) => c.id === cierreId)
      if (cierre === undefined) throw new Error(`El cierre ${cierreId} no existe`)
      const { resultado, costosUsados } = await calcular(
        cierre.tipo, cierre.desde, cierre.hasta, cierre.efectivo, cierre.transferencias, cierre.costosManuales,
      )
      await dependencias.cierres.recalcularCierre(cierre.id, costosUsados, resultado)
    },
  }
}
