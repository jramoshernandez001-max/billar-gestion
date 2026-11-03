/**
 * Detección de cierres desactualizados.
 *
 * Qué hace: dice cuáles cierres guardados ya no reflejan los datos actuales.
 * Cómo lo hace: convierte las entradas de la bitácora que tocan ventas,
 * compras, deudas o abonos en cambios (anulación, corrección de costo o
 * registro nuevo) y se los pasa a `estaDesactualizado` del dominio, que
 * compara su momento con el del cálculo del cierre.
 * Por qué: un cierre nunca se recalcula solo; el usuario debe enterarse de
 * que algo que usó cambió. La bitácora ya trae qué cambió, cuándo y la fecha
 * del registro, así que no hace falta otra tabla.
 */
import { estaDesactualizado, type CambioRegistro, type RegistroAfectado } from '../domain/cierres/actualizacionCierre'
import type { RepositorioBitacora, EntradaBitacora } from '../datos/bitacora'
import type { RepositorioCierres } from '../datos/cierres'

/** Lo que el detector necesita de los repositorios. */
export interface DependenciasDesactualizados {
  cierres: Pick<RepositorioCierres, 'listarCierres'>
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
}

/** Operaciones del detector. */
export interface DetectorDesactualizados {
  /** Ids de los cierres que hay que recalcular. */
  idsDesactualizados(): Promise<string[]>
}

/** Tabla de la base → clase de registro que usan los cierres. */
const REGISTRO_POR_TABLA: Readonly<Record<string, RegistroAfectado>> = {
  ventas: 'venta',
  compras: 'compra',
  deudas: 'deuda',
  abonos_deuda: 'abono',
}

/**
 * Convierte una entrada de bitácora en un cambio, o null si no afecta cierres.
 *
 * Qué hace: traduce acción y tabla al tipo de cambio y registro del dominio.
 * Cómo lo hace: solo mira anular-registro, corregir-costo-compra y los
 * registrar-* de venta, compra, deuda y abono; toma la fecha del registro
 * (y el producto, en compras) de lo que quedó guardado en `despues`.
 * Por qué: la fecha del registro, no la del cambio, decide si cae en el
 * periodo del cierre.
 *
 * @throws Error si una entrada relevante no trae la fecha del registro.
 */
function aCambio(entrada: EntradaBitacora): CambioRegistro | null {
  const registro = entrada.tabla === null ? undefined : REGISTRO_POR_TABLA[entrada.tabla]
  if (registro === undefined || entrada.registroId === null) return null

  let tipoCambio: CambioRegistro['tipoCambio']
  if (entrada.accion === 'anular-registro') tipoCambio = 'anulacion'
  else if (entrada.accion === 'corregir-costo-compra') tipoCambio = 'correccion-costo'
  else if (['registrar-venta', 'registrar-compra', 'registrar-deuda', 'registrar-abono'].includes(entrada.accion)) {
    tipoCambio = 'registro-nuevo'
  } else return null

  const fecha = entrada.despues.fecha
  if (typeof fecha !== 'string') {
    throw new Error(`La entrada de bitácora ${entrada.id} no trae la fecha del registro`)
  }
  const productoId = entrada.despues.producto_id
  return {
    tipoCambio,
    registro,
    id: entrada.registroId,
    fecha,
    momento: entrada.momento,
    ...(registro === 'compra' && typeof productoId === 'string' ? { productoId } : {}),
  }
}

/** Crea el detector de cierres desactualizados. */
export function crearDetectorDesactualizados(dependencias: DependenciasDesactualizados): DetectorDesactualizados {
  return {
    async idsDesactualizados() {
      const [cierres, bitacora] = await Promise.all([
        dependencias.cierres.listarCierres(),
        dependencias.bitacora.listarBitacora(),
      ])
      const cambios = bitacora.map(aCambio).filter((c): c is CambioRegistro => c !== null)
      return cierres.filter((cierre) => estaDesactualizado(cierre, cambios)).map((cierre) => cierre.id)
    },
  }
}
