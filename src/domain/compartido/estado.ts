/**
 * Estado de los registros que se pueden anular.
 *
 * Qué hace: define los estados posibles (vigente o anulada) y dice si un
 * registro sigue vigente.
 * Cómo lo hace: un tipo de unión de cadenas y una función pura que revisa el
 * estado contra la lista de estados válidos.
 * Por qué: nada se borra. Ventas, compras, deudas y abonos se anulan
 * cambiando su estado, y los cálculos (última compra, saldo, cierres) deben
 * ignorar lo anulado. Un solo lugar define qué significa "vigente".
 */

/** Estados de un registro que se puede anular. */
export type EstadoRegistro = 'vigente' | 'anulada'

/** Lista de estados válidos, para revisar datos que llegan de afuera. */
const ESTADOS_REGISTRO: readonly string[] = ['vigente', 'anulada']

/**
 * Dice si un registro está vigente.
 *
 * Qué hace: devuelve true si el estado es vigente y false si es anulada.
 * Cómo lo hace: valida el estado contra la lista y lo compara.
 * Por qué: el tipo protege al compilar, pero los datos pueden llegar de la
 * base de datos o de una versión vieja de la app; un estado desconocido es un
 * error que no se debe tomar como vigente ni como anulado en silencio.
 *
 * @param nombre Cómo nombrar el registro en el mensaje (ej.: "La compra c1").
 * @throws Error si el estado no es uno de los conocidos.
 */
export function estaVigente(registro: { estado: EstadoRegistro }, nombre: string): boolean {
  if (!ESTADOS_REGISTRO.includes(registro.estado)) {
    throw new Error(`${nombre} tiene un estado desconocido`)
  }
  return registro.estado === 'vigente'
}
