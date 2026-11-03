/**
 * Utilidad semanal.
 *
 * Qué hace: calcula cuánto cuesta reponer lo vendido (con el costo de la
 * última compra de cada producto) y, con eso, la utilidad que debería quedar
 * (esperada), la que realmente quedó (real) y la diferencia entre las dos.
 * Cómo lo hace: funciones puras. El costo de reposición se calcula por
 * producto con el total de unidades vendidas y se redondea una sola vez al
 * peso. Todo el dinero va en pesos enteros, sin decimales.
 * Por qué: el dueño quiere saber cuánta plata le debería quedar después de
 * volver a comprar lo que vendió. Se usa el costo de la última compra porque
 * es lo que realmente cuesta reponer hoy, y redondear una sola vez evita que
 * se acumulen errores de centavos entre muchas unidades.
 */

/**
 * Referencia de costo: la última compra de un producto.
 * Una caja x38 por 100.000 se guarda como 38 unidades y 100.000 de costo;
 * 5 unidades sueltas por 14.000 se guardan como 5 unidades y 14.000.
 * Así el mismo cálculo sirve para compras por caja y por unidad.
 */
export interface UltimaCompra {
  /** Unidades que cubrió esa compra. */
  unidades: number
  /** Lo que se pagó por esas unidades, en pesos. */
  costoTotal: number
}

/** Lo vendido de un producto junto con su costo de referencia. */
export interface LineaReposicion {
  /** Total de unidades vendidas de ese producto en el periodo. */
  unidadesVendidas: number
  ultimaCompra: UltimaCompra
}

/** Datos para calcular la utilidad de la semana, en pesos. */
export interface DatosUtilidad {
  /** Valor total de lo vendido en la semana. */
  valorVentas: number
  /** Costo de reponer lo vendido. */
  costoReposicion: number
  /** Efectivo + transferencias + deudas de la semana. */
  dineroTotal: number
}

/** Resultado de la utilidad semanal. */
export interface ResultadoUtilidad {
  /** Utilidad que debería quedar: ventas menos costo de reposición. */
  utilidadEsperada: number
  /** Utilidad que quedó: dinero total menos costo de reposición. */
  utilidadReal: number
  /** Real menos esperada; negativa cuando falta plata, como en el cuadre. */
  diferencia: number
}

/**
 * Comprueba que un monto sea un entero mayor o igual a cero.
 *
 * Qué hace: lanza un error si el monto no es válido.
 * Cómo lo hace: revisa que sea entero y no negativo.
 * Por qué: en pesos colombianos no se manejan decimales, y un monto negativo
 * falsearía la utilidad en silencio.
 */
function validarMonto(nombre: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nombre} debe ser un entero mayor o igual a cero`)
  }
}

/**
 * Calcula cuánto cuesta reponer las unidades vendidas de un producto.
 *
 * Qué hace: devuelve unidades vendidas por el costo de una unidad de la
 * última compra, redondeado al peso.
 * Cómo lo hace: multiplica antes de dividir y redondea una sola vez al final.
 * Por qué: dividir primero (costo por unidad) y multiplicar después arrastra
 * decimales que se acumulan; así el error es de máximo medio peso por producto.
 *
 * @throws Error si las unidades vendidas no son un entero mayor o igual a cero,
 * si las unidades de la compra no son un entero mayor a cero, o si el costo
 * de la compra no es un entero mayor o igual a cero.
 */
export function costoReposicion(
  unidadesVendidas: number,
  ultimaCompra: UltimaCompra,
): number {
  validarMonto('Las unidades vendidas', unidadesVendidas)
  validarMonto('El costo de la última compra', ultimaCompra.costoTotal)
  // Dividir entre cero o entre un decimal daría un costo sin sentido.
  if (!Number.isInteger(ultimaCompra.unidades) || ultimaCompra.unidades <= 0) {
    throw new Error('Las unidades de la última compra deben ser un entero mayor a cero')
  }

  return Math.round(
    (unidadesVendidas * ultimaCompra.costoTotal) / ultimaCompra.unidades,
  )
}

/**
 * Suma el costo de reposición de todos los productos vendidos.
 *
 * Qué hace: devuelve el costo total de volver a comprar lo vendido.
 * Cómo lo hace: calcula el costo de cada línea (un producto) y suma los
 * resultados ya redondeados.
 * Por qué: cada producto tiene su propia última compra y su propio costo.
 */
export function costoReposicionTotal(lineas: readonly LineaReposicion[]): number {
  return lineas.reduce(
    (total, linea) =>
      total + costoReposicion(linea.unidadesVendidas, linea.ultimaCompra),
    0,
  )
}

/**
 * Calcula la utilidad semanal.
 *
 * Qué hace: devuelve la utilidad esperada, la real y su diferencia.
 * Cómo lo hace: resta el costo de reposición de las ventas (esperada) y del
 * dinero disponible (real); la diferencia es real menos esperada.
 * Por qué: la esperada dice cuánto debería quedar; la real, cuánto quedó. La
 * diferencia equivale al faltante o sobrante del cierre. La utilidad puede
 * salir negativa si se vendió por debajo del costo, y eso se permite.
 *
 * @throws Error si algún monto no es un entero mayor o igual a cero.
 */
export function calcularUtilidadSemanal(datos: DatosUtilidad): ResultadoUtilidad {
  validarMonto('El valor de las ventas', datos.valorVentas)
  validarMonto('El costo de reposición', datos.costoReposicion)
  validarMonto('El dinero total', datos.dineroTotal)

  const utilidadEsperada = datos.valorVentas - datos.costoReposicion
  const utilidadReal = datos.dineroTotal - datos.costoReposicion

  return {
    utilidadEsperada,
    utilidadReal,
    diferencia: utilidadReal - utilidadEsperada,
  }
}