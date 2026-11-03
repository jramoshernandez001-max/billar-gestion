/**
 * Bitácora de auditoría.
 *
 * Qué hace: construye el registro de un cambio: quién lo hizo, cuándo, qué
 * acción fue, y cómo estaba el valor antes y cómo quedó después.
 * Cómo lo hace: función pura que valida los datos y devuelve un objeto
 * nuevo. La fecha y hora se recibe como parámetro en vez de leer el reloj,
 * y se guarda en formato ISO en UTC.
 * Por qué: los dos usuarios tienen los mismos permisos, así que hace falta
 * saber quién cambió cada cosa y cuándo. Recibir la hora desde afuera deja
 * probar la función sin depender del reloj, y UTC evita confusiones si un
 * celular tiene otra zona horaria. La bitácora sí lleva hora, a diferencia
 * de las fechas de negocio (AAAA-MM-DD), porque importa el orden exacto.
 */

/** Datos para construir un registro. */
export interface DatosRegistroBitacora<T> {
  /** Quién hizo el cambio (por ejemplo, su correo de Google). */
  usuario: string
  /** Cuándo se hizo el cambio. */
  momento: Date
  /** Qué se hizo, en palabras (por ejemplo, "editar precio de caja"). */
  accion: string
  /** Valor antes del cambio; null si el registro es de algo nuevo. */
  antes: T | null
  /** Valor después del cambio; null si el registro es de algo borrado. */
  despues: T | null
}

/** Un registro de la bitácora, listo para guardar. */
export interface RegistroBitacora<T> {
  usuario: string
  /** Fecha y hora en formato ISO 8601, en UTC. */
  fechaHora: string
  accion: string
  antes: T | null
  despues: T | null
}

/**
 * Comprueba que un texto obligatorio no esté vacío y lo devuelve limpio.
 *
 * Qué hace: quita espacios a los lados y lanza un error si no queda nada.
 * Cómo lo hace: usa trim y revisa el largo.
 * Por qué: un registro sin usuario o sin acción no sirve para auditar.
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
 * Cómo lo hace: valida usuario, acción y fecha, pasa la fecha a texto ISO y
 * copia en profundidad los valores antes y después con structuredClone.
 * Por qué: la copia evita que un cambio posterior al objeto original altere
 * lo que quedó registrado; una bitácora que se puede alterar no sirve.
 *
 * @throws Error si el usuario o la acción están vacíos, o si la fecha y
 * hora no es válida.
 */
export function crearRegistroBitacora<T>(
  datos: DatosRegistroBitacora<T>,
): RegistroBitacora<T> {
  const usuario = textoObligatorio('El usuario', datos.usuario)
  const accion = textoObligatorio('La acción', datos.accion)
  // Un Date inválido haría fallar toISOString con un error genérico.
  if (Number.isNaN(datos.momento.getTime())) {
    throw new Error('La fecha y hora de la bitácora no es válida')
  }

  return {
    usuario,
    fechaHora: datos.momento.toISOString(),
    accion,
    antes: structuredClone(datos.antes),
    despues: structuredClone(datos.despues),
  }
}
