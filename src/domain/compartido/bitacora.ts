/**
 * Bitácora de auditoría.
 *
 * Qué hace: construye el registro de un cambio: quién lo hizo, cuándo, qué
 * acción fue (de una lista fija), y cómo estaba el valor antes y cómo quedó
 * después.
 * Cómo lo hace: función pura que valida los datos y devuelve un objeto
 * nuevo. La fecha y hora se recibe como parámetro en vez de leer el reloj,
 * y se guarda en formato ISO en UTC.
 * Por qué: los dos usuarios tienen los mismos permisos, así que hace falta
 * saber quién cambió cada cosa y cuándo. Se registra todo lo que cambia
 * datos, y nada se borra: un error se corrige con una anulación que también
 * queda aquí. Recibir la hora desde afuera deja probar la función sin
 * depender del reloj, y UTC evita confusiones si un celular tiene otra zona
 * horaria. La bitácora sí lleva hora, a diferencia de las fechas de negocio
 * (AAAA-MM-DD), porque importa el orden exacto.
 */

/**
 * Todas las acciones que cambian datos y por eso quedan en la bitácora.
 * Es una lista cerrada: si aparece una acción nueva, se agrega aquí.
 */
export const ACCIONES_BITACORA = [
  'registrar-compra',
  'corregir-costo-compra',
  'registrar-traslado',
  'registrar-ajuste',
  'registrar-venta',
  'registrar-cierre-diario',
  'registrar-cierre-semanal',
  'registrar-deuda',
  'registrar-abono',
  'cambiar-precio',
  'crear-producto',
  'editar-producto',
  'anular-registro',
  'recalcular-cierre-diario',
  'recalcular-cierre-semanal',
] as const

/** Una de las acciones de la lista fija (unión de cadenas). */
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number]

/** Datos para construir un registro. */
export interface DatosRegistroBitacora<T> {
  /** Quién hizo el cambio (por ejemplo, su correo de Google). */
  usuario: string
  /** Cuándo se hizo el cambio. */
  momento: Date
  /** Qué se hizo. */
  accion: AccionBitacora
  /** Valor antes del cambio; null si el registro es de algo nuevo. */
  antes: T | null
  /** Valor después del cambio. Nunca falta, porque nada se borra. */
  despues: T
}

/** Un registro de la bitácora, listo para guardar. */
export interface RegistroBitacora<T> {
  usuario: string
  /** Fecha y hora en formato ISO 8601, en UTC. */
  fechaHora: string
  accion: AccionBitacora
  antes: T | null
  despues: T
}

/**
 * Dice si un texto es una de las acciones de la lista fija.
 *
 * Qué hace: devuelve true solo si coincide exactamente con alguna.
 * Cómo lo hace: busca el texto en ACCIONES_BITACORA.
 * Por qué: el tipo protege al compilar, pero una acción puede llegar de
 * afuera (base de datos, una versión vieja de la app); por eso se revisa
 * también cuando el programa corre.
 */
export function esAccionBitacora(accion: string): accion is AccionBitacora {
  return (ACCIONES_BITACORA as readonly string[]).includes(accion)
}

/**
 * Comprueba que un texto obligatorio no esté vacío y lo devuelve limpio.
 *
 * Qué hace: quita espacios a los lados y lanza un error si no queda nada.
 * Cómo lo hace: usa trim y revisa el largo.
 * Por qué: un registro sin usuario no sirve para auditar.
 */
function textoObligatorio(nombre: string, valor: string): string {
  const limpio = valor.trim()
  if (limpio.length === 0) {
    throw new Error(`${nombre} es obligatorio en la bitácora`)
  }
  return limpio
}

/**
 * Construye un registro de la bitácora.
 *
 * Qué hace: devuelve el registro con usuario, fecha y hora, acción, antes y
 * después.
 * Cómo lo hace: valida usuario, acción, fecha y valor después; pasa la fecha
 * a texto ISO y copia en profundidad los valores antes y después con
 * structuredClone.
 * Por qué: la copia evita que un cambio posterior al objeto original altere
 * lo que quedó registrado; una bitácora que se puede alterar no sirve.
 *
 * @throws Error si el usuario está vacío, si la acción no está en la lista
 * fija, si la fecha y hora no es válida o si falta el valor después.
 */
export function crearRegistroBitacora<T>(
  datos: DatosRegistroBitacora<T>,
): RegistroBitacora<T> {
  const usuario = textoObligatorio('El usuario', datos.usuario)
  if (!esAccionBitacora(datos.accion)) {
    throw new Error(`La acción "${datos.accion}" no está en la lista de acciones de la bitácora`)
  }
  // Un Date inválido haría fallar toISOString con un error genérico.
  if (Number.isNaN(datos.momento.getTime())) {
    throw new Error('La fecha y hora de la bitácora no es válida')
  }
  if (datos.despues === null || datos.despues === undefined) {
    throw new Error('El valor después es obligatorio en la bitácora: nada se borra')
  }

  return {
    usuario,
    fechaHora: datos.momento.toISOString(),
    accion: datos.accion,
    antes: structuredClone(datos.antes),
    despues: structuredClone(datos.despues),
  }
}
