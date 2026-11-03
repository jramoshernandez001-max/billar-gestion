/**
 * Cuadre de un cierre (diario o semanal).
 *
 * Qué hace: compara el valor de lo vendido con el dinero disponible
 * (efectivo + transferencias + deudas) y dice si cuadra, y cuánto falta o
 * cuánto sobra.
 * Cómo lo hace: función pura que suma el dinero, lo resta del valor de las
 * ventas y deriva el faltante y el sobrante de esa diferencia. Todo el dinero
 * va en pesos enteros, sin decimales.
 * Por qué: es la regla central del negocio. El cierre cuadra si el dinero es
 * igual o mayor que lo vendido; el faltante se registra para saber cuánta
 * plata no apareció. Diario y semanal usan este mismo cálculo; lo único que
 * cambia entre ellos es qué ventas y qué deudas se le pasan.
 */

/** Datos que se comparan en un cierre, todos en pesos. */
export interface DatosCierre {
  /** Valor total de lo vendido en el periodo. */
  valorVentas: number
  /** Dinero en efectivo. */
  efectivo: number
  /** Dinero recibido por transferencias. */
  transferencias: number
  /** Deudas del periodo que aún cuentan como dinero por cobrar. */
  deudas: number
}

/** Resultado de comparar la venta con el dinero. */
export interface ResultadoCuadre {
  /** Efectivo + transferencias + deudas. */
  dineroTotal: number
  /** Dinero total menos valor de ventas; negativo cuando falta plata. */
  diferencia: number
  /** Verdadero si el dinero es igual o mayor que lo vendido. */
  cuadra: boolean
  /** Plata que falta; cero cuando cuadra. */
  faltante: number
  /** Plata que sobra; cero cuando no sobra o falta. */
  sobrante: number
}

/**
 * Comprueba que un monto sea un entero mayor o igual a cero.
 *
 * Qué hace: lanza un error si el monto no es válido.
 * Cómo lo hace: revisa que sea entero y no negativo.
 * Por qué: en pesos colombianos no se manejan decimales, y un monto negativo
 * falsearía el cuadre en silencio.
 */
function validarMonto(nombre: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nombre} debe ser un entero mayor o igual a cero`)
  }
}

/**
 * Cuadra un cierre comparando la venta con el dinero.
 *
 * Qué hace: devuelve el dinero total, la diferencia, si cuadra y el faltante
 * o sobrante.
 * Cómo lo hace: valida los cuatro montos, suma el dinero y calcula la
 * diferencia con el valor de las ventas.
 * Por qué: el cierre existe para detectar si falta plata.
 *
 * @throws Error si algún monto no es un entero mayor o igual a cero.
 */
export function cuadrarCierre(datos: DatosCierre): ResultadoCuadre {
  validarMonto('El valor de las ventas', datos.valorVentas)
  validarMonto('El efectivo', datos.efectivo)
  validarMonto('Las transferencias', datos.transferencias)
  validarMonto('Las deudas', datos.deudas)

  const dineroTotal = datos.efectivo + datos.transferencias + datos.deudas
  const diferencia = dineroTotal - datos.valorVentas

  return {
    dineroTotal,
    diferencia,
    // Igual o más que lo vendido se considera cuadrado.
    cuadra: diferencia >= 0,
    faltante: Math.max(0, -diferencia),
    sobrante: Math.max(0, diferencia),
  }
}