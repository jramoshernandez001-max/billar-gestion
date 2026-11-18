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
import { validarPeriodoSemanal } from '../domain/compartido/semana'
import { validarSinCruceSemanal } from '../domain/cierres/crucesCierre'
import { validarFecha } from '../domain/compartido/validaciones'
import type { Venta } from '../domain/ventas/venta'
import type { RepositorioCierres } from '../datos/cierres'
import type { RepositorioDeudas } from '../datos/deudas'
import type { RepositorioInventario } from '../datos/inventario'

/** Lo que el servicio necesita de cada repositorio. */
export interface DependenciasCierres {
  /** Solo necesita leer ventas del dominio (no el momento de registro). */
  ventas: { listarVentas(): Promise<Venta[]> }
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos'>
  inventario: Pick<RepositorioInventario, 'listarCompras'>
  cierres: Pick<RepositorioCierres, 'guardarCierre' | 'recalcularCierre' | 'listarCierres'>
}

/** Datos que captura el usuario para cerrar un periodo. */
export interface DatosCerrarPeriodo {
  tipo: TipoCierre
  /** Día del cierre diario, o primer día del cierre semanal. */
  desde: string
  /** Último día del cierre semanal (obligatorio en el semanal; el diario lo ignora). */
  hasta?: string
  efectivo: number
  transferencias: number
  /** Costo por unidad de productos vendidos sin compras (solo semanal). */
  costosManuales?: Record<string, number>
}

/** Operaciones del servicio. */
export interface ServicioCierres {
  /** Calcula el cierre sin guardarlo, para mostrarlo antes de confirmar. */
  vistaPreviaCierre(datos: DatosCerrarPeriodo): Promise<VistaPreviaCierre>
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

/** Lo que se muestra antes de guardar un cierre. */
export interface VistaPreviaCierre extends Calculo {
  /** Último día del periodo. */
  hasta: string
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
  /**
   * Último día del periodo.
   * Cómo: en el diario es el mismo día; en el semanal es el que eligió el
   * usuario, y se valida que exista y no sea anterior al inicio.
   * Por qué: el semanal ya no tiene largo fijo; lo decide el usuario.
   */
  function ultimoDia(tipo: TipoCierre, desde: string, hasta: string | undefined): string {
    validarFecha('El inicio del cierre', desde)
    if (tipo === 'diario') return desde
    if (hasta === undefined) throw new Error('Falta la fecha de fin del cierre semanal')
    validarPeriodoSemanal(desde, hasta)
    return hasta
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

  /**
   * Calcula un cierre nuevo sin guardarlo.
   * Cómo: toma el último día, revisa que un semanal no se cruce con otro,
   * calcula con los datos de hoy y lo devuelve.
   * Por qué: cerrarPeriodo y la vista previa deben dar exactamente lo mismo.
   */
  async function calcularNuevo(datos: DatosCerrarPeriodo) {
    const hasta = ultimoDia(datos.tipo, datos.desde, datos.hasta)
    if (datos.tipo === 'semanal') {
      validarSinCruceSemanal({ desde: datos.desde, hasta }, await dependencias.cierres.listarCierres())
    }
    const costosManuales = datos.costosManuales ?? {}
    const calculo = await calcular(
      datos.tipo, datos.desde, hasta, datos.efectivo, datos.transferencias, costosManuales,
    )
    return { ...calculo, hasta, costosManuales }
  }

  return {
    async vistaPreviaCierre(datos) {
      const { resultado, costosUsados, hasta } = await calcularNuevo(datos)
      return { hasta, resultado, costosUsados }
    },

    async cerrarPeriodo(datos) {
      const { resultado, costosUsados, hasta, costosManuales } = await calcularNuevo(datos)
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
