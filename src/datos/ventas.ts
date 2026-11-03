/**
 * Repositorio de ventas.
 *
 * Qué hace: registra y anula ventas llamando a las funciones de la base.
 * Cómo lo hace: valida la fecha y cada renglón, descarta los renglones con
 * cantidad cero y manda el resto como lista JSON con los nombres que espera
 * `registrar_venta`. Anular manda el id y el motivo.
 * Por qué: la base crea la venta, sus renglones, el descuento de la nevera y
 * la bitácora en una sola transacción; aquí solo se arma bien la petición.
 * Si no se manda precio cobrado, la base usa el precio vigente del producto
 * y lo guarda en la venta para que cambios futuros no alteren el historial.
 */
import type { Presentacion } from '../domain/inventario/conversiones'
import { validarFecha, validarMonto } from '../domain/compartido/validaciones'
import { llamarFuncion, type ClienteDatos } from './clienteDatos'
import { exigirId, exigirIdRespuesta, exigirTexto, exigirUnoDe } from './entradas'

const PRESENTACIONES: readonly Presentacion[] = ['unidad', 'sixpack', 'caja']

/** Un renglón de venta tal como lo captura la app. */
export interface RenglonVenta {
  productoId: string
  presentacion: Presentacion
  /** Cantidad de presentaciones; cero se ignora. */
  cantidad: number
  /** Precio por presentación; si falta, la base usa el precio de lista. */
  precioCobrado?: number
}

/** Datos de una venta. */
export interface DatosVenta {
  /** Día de la venta, AAAA-MM-DD. */
  fecha: string
  renglones: RenglonVenta[]
}

/** Operaciones de ventas. */
export interface RepositorioVentas {
  registrarVenta(datos: DatosVenta): Promise<string>
  anularVenta(ventaId: string, motivo: string): Promise<void>
}

/**
 * Valida un renglón y lo deja con los nombres de la base.
 *
 * Qué hace: devuelve el renglón listo para enviar.
 * Cómo lo hace: exige producto, presentación válida y cantidad entera no
 * negativa; el precio, si viene, debe ser un monto válido.
 * Por qué: un renglón mal armado haría fallar toda la venta en la base.
 */
function renglonAJson(renglon: RenglonVenta): Record<string, unknown> {
  if (!Number.isInteger(renglon.cantidad) || renglon.cantidad < 0) {
    throw new Error('La cantidad de cada renglón debe ser un entero mayor o igual a cero')
  }
  const json: Record<string, unknown> = {
    producto_id: exigirId('El producto', renglon.productoId),
    presentacion: exigirUnoDe('La presentación', renglon.presentacion, PRESENTACIONES),
    cantidad: renglon.cantidad,
  }
  if (renglon.precioCobrado !== undefined) {
    validarMonto('El precio cobrado', renglon.precioCobrado)
    json.precio_cobrado = renglon.precioCobrado
  }
  return json
}

/**
 * Crea el repositorio de ventas.
 *
 * Qué hace: devuelve registrar y anular venta sobre un cliente de datos.
 * Cómo lo hace: cierra sobre el cliente.
 * Por qué: recibirlo por parámetro permite probarlo sin Supabase.
 */
export function crearRepositorioVentas(cliente: ClienteDatos): RepositorioVentas {
  return {
    async registrarVenta(datos) {
      validarFecha('La fecha de la venta', datos.fecha)
      const renglones = datos.renglones.map(renglonAJson).filter((r) => r.cantidad !== 0)
      if (renglones.length === 0) {
        throw new Error('La venta no tiene nada que registrar: todos los renglones tienen cantidad cero')
      }
      const id = await llamarFuncion(cliente, 'registrar_venta', {
        p_fecha: datos.fecha,
        p_items: renglones,
      })
      return exigirIdRespuesta(id)
    },

    async anularVenta(ventaId, motivo) {
      await llamarFuncion(cliente, 'anular_venta', {
        p_venta_id: exigirId('La venta', ventaId),
        p_motivo: exigirTexto('El motivo', motivo),
      })
    },
  }
}
