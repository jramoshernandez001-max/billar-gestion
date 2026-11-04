/**
 * Lista de productos vendidos en un cierre.
 *
 * Qué hace: muestra, por producto, lo que se vendió (desglose y unidades) y
 * su valor, con los totales del periodo.
 * Cómo lo hace: dibuja un `ProductosVendidos` ya calculado; no calcula nada.
 * Por qué: el detalle de un cierre debe mostrar qué se vendió ese día o esa
 * semana, no solo el total de dinero.
 */
import type { ProductosVendidos as Datos } from '../../aplicacion/productosVendidos'
import { formatoPesos } from '../formato'

export function ProductosVendidos({ datos }: { datos: Datos }) {
  return (
    <section className="tarjeta" aria-label="Productos vendidos">
      <div className="tarjeta__cabecera">
        <span className="renglones__descripcion">Productos vendidos</span>
        <span className="texto-suave">
          {datos.ventas} {datos.ventas === 1 ? 'venta' : 'ventas'}
        </span>
      </div>

      {datos.filas.length === 0 && <p className="estado">No hubo ventas vigentes en este periodo.</p>}

      {datos.filas.map((fila) => (
        <div key={fila.productoId} className="dato" data-producto={fila.productoId}>
          <span className="dato__etiqueta">
            {fila.nombre}
            <span className="texto-suave"> · {fila.desglose}</span>
          </span>
          <span className="dato__valor">{formatoPesos(fila.valor)}</span>
        </div>
      ))}

      {datos.filas.length > 0 && (
        <>
          <div className="division" />
          <div className="dato">
            <span className="dato__etiqueta">Total · {datos.totalUnidades} {datos.totalUnidades === 1 ? 'unidad' : 'unidades'}</span>
            <span className="dato__total">{formatoPesos(datos.totalValor)}</span>
          </div>
        </>
      )}
    </section>
  )
}
