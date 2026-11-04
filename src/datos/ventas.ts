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
import type { Venta } from '../domain/ventas/venta'
import { validarFecha, validarMonto } from '../domain/compartido/validaciones'
import { leerFilas, llamarFuncion, type ClienteDatos } from './clienteDatos'
import { esEntero, esObjeto, exigirId, exigirIdRespuesta, exigirTexto, exigirUnoDe } from './entradas'
import { COLUMNAS_PRODUCTO, filaAProductoVendible } from './filasProducto'

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

/**
 * Venta leída de la base: la del dominio más el momento en que se registró.
 * Por qué: la pantalla de ventas muestra la hora y numera las ventas por
 * orden de registro; el dominio no necesita ese dato.
 */
export interface VentaRegistrada extends Venta {
  /** Cuándo se registró, en ISO 8601 UTC. */
  creadoEn: string
}

/** Operaciones de ventas. */
export interface RepositorioVentas {
  registrarVenta(datos: DatosVenta): Promise<string>
  anularVenta(ventaId: string, motivo: string): Promise<void>
  /** Ventas con sus renglones (vigentes y anuladas), como las usa el dominio. */
  listarVentas(): Promise<VentaRegistrada[]>
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
 * Arma las ventas a partir de las filas de ventas, renglones y productos.
 *
 * Qué hace: devuelve cada venta con sus renglones y el producto vendido.
 * Cómo lo hace: indexa los productos por id, agrupa los renglones por venta
 * y copia el precio cobrado guardado en cada renglón.
 * Por qué: el cierre usa el precio que se cobró entonces, no el de hoy.
 */
function armarVentas(ventas: unknown[], renglones: unknown[], productos: unknown[]): VentaRegistrada[] {
  const porProducto = new Map(productos.map((fila) => {
    const p = filaAProductoVendible(fila)
    return [p.id, p.producto] as const
  }))
  const porVenta = new Map<string, Venta['renglones'][number][]>()
  for (const fila of renglones) {
    if (
      !esObjeto(fila) ||
      typeof fila.venta_id !== 'string' ||
      typeof fila.producto_id !== 'string' ||
      !esEntero(fila.cantidad) ||
      !esEntero(fila.precio_cobrado) ||
      !PRESENTACIONES.includes(fila.presentacion as Presentacion)
    ) {
      throw new Error('Una fila de renglones de venta no tiene la forma esperada')
    }
    const producto = porProducto.get(fila.producto_id)
    if (producto === undefined) throw new Error(`El producto ${fila.producto_id} de un renglón no existe`)
    const lista = porVenta.get(fila.venta_id) ?? []
    lista.push({
      productoId: fila.producto_id,
      producto,
      presentacion: fila.presentacion as Presentacion,
      cantidad: fila.cantidad,
      precioCobrado: fila.precio_cobrado,
    })
    porVenta.set(fila.venta_id, lista)
  }
  return ventas.map((fila) => {
    if (
      !esObjeto(fila) ||
      typeof fila.id !== 'string' ||
      typeof fila.fecha !== 'string' ||
      typeof fila.creado_en !== 'string' ||
      Number.isNaN(new Date(fila.creado_en).getTime()) ||
      (fila.estado !== 'vigente' && fila.estado !== 'anulada')
    ) {
      throw new Error('Una fila de ventas no tiene la forma esperada')
    }
    return {
      id: fila.id,
      fecha: fila.fecha,
      estado: fila.estado,
      // PostgREST entrega "...+00:00"; se normaliza a ISO UTC como en los cierres.
      creadoEn: new Date(fila.creado_en).toISOString(),
      renglones: porVenta.get(fila.id) ?? [],
    }
  })
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

    async listarVentas() {
      const [ventas, renglones, productos] = await Promise.all([
        leerFilas(cliente, 'ventas', 'id, fecha, estado, creado_en'),
        leerFilas(cliente, 'venta_items', 'venta_id, producto_id, presentacion, cantidad, precio_cobrado'),
        leerFilas(cliente, 'productos', COLUMNAS_PRODUCTO),
      ])
      return armarVentas(ventas, renglones, productos)
    },
  }
}
