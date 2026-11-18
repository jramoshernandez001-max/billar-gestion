/**
 * Mensajes de confirmación de las acciones.
 *
 * Qué hace: reúne en un solo lugar el texto de la ventanita que aparece
 * cuando una acción sale bien ("Venta registrada con éxito").
 * Cómo lo hace: un objeto de solo lectura, una entrada por acción.
 * Por qué: los textos quedan iguales en toda la app y se cambian en un solo
 * archivo.
 */
export const MENSAJES_ACCION = {
  ventaRegistrada: 'Venta registrada con éxito',
  ventaEditada: 'Venta corregida con éxito',
  ventaAnulada: 'Venta anulada',
  compraRegistrada: 'Compra registrada con éxito',
  compraAnulada: 'Compra anulada',
  costoCorregido: 'Costo de la compra corregido',
  trasladoRegistrado: 'Traslado a la nevera registrado',
  ajusteRegistrado: 'Ajuste de stock guardado',
  productoCreado: 'Producto creado con éxito',
  productoEditado: 'Producto actualizado',
  deudaRegistrada: 'Deuda registrada con éxito',
  deudaAnulada: 'Deuda anulada',
  abonoRegistrado: 'Abono registrado con éxito',
  abonoAnulado: 'Abono anulado',
  cierreGuardado: 'Cierre guardado con éxito',
  cierreRecalculado: 'Cierre recalculado',
  dineroCorregido: 'Dinero del cierre corregido',
} as const

/** Nombre de una acción con mensaje. */
export type AccionConMensaje = keyof typeof MENSAJES_ACCION
