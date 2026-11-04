/**
 * Carga de datos del inicio.
 *
 * Qué hace: reúne ventas, deudas, stock y cierres y devuelve lo que necesita
 * la pantalla de inicio: el resumen, cuántas cuentas tienen deuda y cuál es
 * el primer cierre desactualizado.
 * Cómo lo hace: lee todo en paralelo de los repositorios y usa
 * `resumirDeudas`, `resumirInventario` y `resumirInicio` para calcular.
 * Por qué: la pantalla solo dibuja; aquí se une cada fuente con su cálculo.
 * Si una lectura falla, el error sube tal cual para mostrarlo.
 */
import type { TipoCierre } from '../domain/cierres/actualizacionCierre'
import type { RepositorioCierres } from '../datos/cierres'
import type { RepositorioDeudas } from '../datos/deudas'
import type { RepositorioInventario } from '../datos/inventario'
import type { RepositorioVentas } from '../datos/ventas'
import type { DetectorDesactualizados } from './cierresDesactualizados'
import { resumirDeudas } from './resumenDeudas'
import { resumirInicio, type ResumenInicio } from './resumenInicio'
import { resumirInventario } from './resumenInventario'

/** Lo que necesita cargarInicio de los servicios. */
export interface ServiciosInicio {
  ventas: Pick<RepositorioVentas, 'listarVentas'>
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos'>
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock'>
  cierres: Pick<RepositorioCierres, 'listarCierres'>
  desactualizados: Pick<DetectorDesactualizados, 'idsDesactualizados'>
}

/** Un cierre que hay que recalcular. */
export interface CierrePorRecalcular {
  id: string
  tipo: TipoCierre
  desde: string
}

/** Datos de la pantalla de inicio. */
export interface DatosInicio {
  resumen: ResumenInicio
  /** Cuántas cuentas siguen debiendo algo. */
  cuentasConDeuda: number
  primerCierreDesactualizado: CierrePorRecalcular | null
}

/** Carga los datos del inicio para el día `hoy` (AAAA-MM-DD). */
export async function cargarInicio(servicios: ServiciosInicio, hoy: string): Promise<DatosInicio> {
  const [ventas, deudas, abonos, productos, stock, cierres, idsDesactualizados] = await Promise.all([
    servicios.ventas.listarVentas(),
    servicios.deudas.listarDeudas(),
    servicios.deudas.listarAbonos(),
    servicios.inventario.listarProductos(),
    servicios.inventario.obtenerStock(),
    servicios.cierres.listarCierres(),
    servicios.desactualizados.idsDesactualizados(),
  ])
  const resumenDeudas = resumirDeudas(deudas, abonos, hoy)
  const filasInventario = resumirInventario(productos, stock)
  const primero = cierres
    .filter((c) => idsDesactualizados.includes(c.id))
    .sort((a, b) => b.desde.localeCompare(a.desde))[0]
  return {
    resumen: resumirInicio({
      hoy,
      ventas,
      deudaPendiente: resumenDeudas.totalPendiente,
      productosNegativos: filasInventario.filter((f) => f.negativo).length,
      cierresDesactualizados: idsDesactualizados.length,
    }),
    cuentasConDeuda: resumenDeudas.filas.filter((f) => f.estado === 'pendiente').length,
    primerCierreDesactualizado: primero === undefined ? null : { id: primero.id, tipo: primero.tipo, desde: primero.desde },
  }
}
