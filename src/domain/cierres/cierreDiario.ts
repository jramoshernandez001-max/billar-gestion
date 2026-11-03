/**
 * Cierre diario.
 *
 * Qué hace: junta lo vendido en el día, el efectivo, las transferencias y
 * las deudas del día, y devuelve si el cierre cuadra.
 * Cómo lo hace: función pura que compone piezas que ya existen:
 * renglonesVigentes y valorVenta para lo vendido (solo ventas vigentes),
 * totalDeudasPendientes con un periodo de un solo día para las deudas, y
 * cuadrarCierre para la comparación.
 * Por qué: la regla del cuadre y la de las deudas ya están probadas en sus
 * módulos; aquí solo se arma el día, sin repetirlas.
 */
import { totalDeudasPendientes, type Abono, type Deuda } from '../deudas/deudas'
import { valorVenta } from '../ventas/valorVenta'
import { renglonesVigentes, type Venta } from '../ventas/venta'
import { cuadrarCierre, type ResultadoCuadre } from './cuadreCierre'

/** Lo que se cuenta al cerrar un día. Dinero en pesos enteros. */
export interface DatosCierreDiario {
  /** Día que se cierra, en formato AAAA-MM-DD. */
  fecha: string
  /** Ventas del día; solo suman las vigentes. */
  ventas: readonly Venta[]
  efectivo: number
  transferencias: number
  /** Deudas registradas; solo entran las nacidas ese día. */
  deudas: readonly Deuda[]
  /** Abonos registrados; restan de lo que se debe hasta ese día. */
  abonos: readonly Abono[]
}

/**
 * Cierra un día.
 *
 * Qué hace: devuelve el resultado del cuadre del día.
 * Cómo lo hace: calcula el valor de lo vendido en las ventas vigentes (una
 * venta anulada no suma), suma lo que siguen debiendo
 * las deudas nacidas ese día (periodo desde = hasta = fecha) y le pasa todo
 * a cuadrarCierre.
 * Por qué: el cierre diario es el mismo cálculo que el semanal con un
 * periodo de un día.
 *
 * @throws Error si la fecha, algún monto o algún renglón es inválido.
 */
export function cerrarDia(datos: DatosCierreDiario): ResultadoCuadre {
  return cuadrarCierre({
    valorVentas: valorVenta(renglonesVigentes(datos.ventas)),
    efectivo: datos.efectivo,
    transferencias: datos.transferencias,
    deudas: totalDeudasPendientes(datos.deudas, datos.abonos, datos.fecha, datos.fecha),
  })
}
