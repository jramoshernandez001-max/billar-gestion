/**
 * Edición de una venta.
 *
 * Qué hace: prepara una venta guardada para corregirla en el formulario de
 * venta: encuentra la venta que se puede editar, la convierte en borrador y
 * arma el motivo que queda en la bitácora.
 * Cómo lo hace: funciones puras; el borrador sale de los renglones guardados
 * y el motivo del texto que escribe la persona (o uno por defecto).
 * Por qué: al equivocarse en el cierre del día había que anular y volver a
 * diligenciar toda la venta. Con esto se abre la venta ya llena y se cambia
 * solo lo errado; la base anula la vieja y registra la corregida en una sola
 * transacción (`editar_venta`), así nada se borra.
 */
import { estaVigente } from '../domain/compartido/estado'
import { precioDeLista } from '../domain/ventas/valorVenta'
import type { Venta } from '../domain/ventas/venta'
import type { AdicionalBorrador, BorradorVenta, RenglonBorrador } from './borradorVenta'

/** Motivo que se usa si la persona no escribe uno. */
export const MOTIVO_POR_DEFECTO = 'Venta editada'

/**
 * Busca la venta que se va a editar.
 *
 * Qué hace: devuelve la venta con ese id si sigue vigente.
 * Cómo lo hace: la busca en la lista y revisa su estado.
 * Por qué: una venta anulada ya no cuenta; editarla no tiene sentido y la
 * base también lo rechazaría.
 *
 * @throws Error si no existe o si ya está anulada.
 */
export function ventaEditable<V extends Venta>(ventas: readonly V[], ventaId: string): V {
  const venta = ventas.find((v) => v.id === ventaId)
  if (venta === undefined) throw new Error('Esa venta no existe')
  if (!estaVigente(venta, `La venta ${venta.id}`)) throw new Error('Esa venta ya está anulada; no se puede editar')
  return venta
}

/**
 * Convierte una venta guardada en un borrador para corregirla.
 *
 * Qué hace: devuelve un borrador con la fecha, los renglones (claves r1,
 * r2…) y los productos adicionales (claves a1, a2…) de la venta, en el mismo
 * orden.
 * Cómo lo hace: copia producto, presentación y cantidad. El precio cobrado se
 * deja vacío si es igual al precio de lista actual, y se conserva si se había
 * cambiado a mano.
 * Por qué: la base siempre guarda el precio cobrado; mostrarlo como vacío
 * cuando es el de lista hace que el formulario se vea igual que al vender, y
 * un precio especial (por ejemplo, una caja a domicilio) no se pierde.
 */
export function borradorDesdeVenta(venta: Venta): BorradorVenta {
  // Los productos adicionales ("Otros") vuelven tal cual, con claves a1, a2…
  const adicionales = (venta.adicionales ?? []).map((a, indice): AdicionalBorrador => ({
    clave: `a${indice + 1}`,
    descripcion: a.descripcion,
    cantidad: a.cantidad,
    valor: a.valor,
  }))
  return {
    fecha: venta.fecha,
    ...(adicionales.length > 0 ? { adicionales } : {}),
    renglones: venta.renglones.map((renglon, indice): RenglonBorrador => {
      const nuevo: RenglonBorrador = {
        clave: `r${indice + 1}`,
        productoId: renglon.productoId,
        presentacion: renglon.presentacion,
        cantidad: renglon.cantidad,
      }
      if (renglon.precioCobrado !== undefined && renglon.precioCobrado !== precioDeLista(renglon.producto, renglon.presentacion)) {
        nuevo.precioCobrado = renglon.precioCobrado
      }
      return nuevo
    }),
  }
}

/**
 * Motivo que queda en la bitácora al editar.
 *
 * Qué hace: devuelve el texto escrito sin espacios sobrantes, o "Venta
 * editada" si está vacío.
 * Cómo lo hace: quita los espacios de los lados y reduce los de en medio.
 * Por qué: anular exige un motivo; para no frenar a quien corrige, el campo
 * es opcional y se usa un motivo claro por defecto.
 */
export function motivoEdicion(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  return limpio === '' ? MOTIVO_POR_DEFECTO : limpio
}

/**
 * Productos que se ofrecen al vender o al editar una venta.
 *
 * Qué hace: devuelve los productos activos y, si se edita una venta, también
 * los eliminados que ya estaban en ella.
 * Cómo lo hace: parte de los activos y agrega de `todos` los que la venta usa
 * y no están en la lista, en su orden.
 * Por qué: una venta vieja puede tener un producto eliminado; sin él no se
 * podría abrir para corregirla. Los eliminados no se ofrecen en ventas nuevas.
 */
export function productosParaVender<P extends { id: string }>(
  activos: readonly P[],
  todos: readonly P[],
  venta: { renglones: readonly { productoId: string }[] } | null,
): P[] {
  if (venta === null) return [...activos]
  const usados = new Set(venta.renglones.map((r) => r.productoId))
  const ids = new Set(activos.map((x) => x.id))
  return [...activos, ...todos.filter((x) => usados.has(x.id) && !ids.has(x.id))]
}
