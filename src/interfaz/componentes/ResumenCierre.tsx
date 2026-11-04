/**
 * Resumen de un cierre.
 *
 * Qué hace: muestra lo vendido, el dinero (efectivo, transferencias y
 * deudas), si el cierre cuadra, falta o sobra y, en el semanal, la utilidad
 * (completa o solo la esperada si falta algún costo).
 * Cómo lo hace: dibuja una `VistaCierre` ya calculada; no calcula nada.
 * Por qué: es el mismo bloque en la vista previa antes de cerrar y en el
 * detalle de un cierre guardado.
 */
import type { VistaCierre } from '../../aplicacion/vistaCierre'
import { formatoPesos } from '../formato'

/** Pesos con signo menos tipográfico cuando son negativos. */
const firmado = (n: number) => (n < 0 ? `−${formatoPesos(-n)}` : formatoPesos(n))

function textoEstado(v: VistaCierre): string {
  if (v.estado === 'faltante') return `Faltante de ${formatoPesos(v.monto)}`
  if (v.estado === 'sobrante') return `Sobrante de ${formatoPesos(v.monto)}`
  return 'Cuadra'
}

export function ResumenCierre({ vista }: { vista: VistaCierre }) {
  const s = vista.semanal
  return (
    <>
      <div className={`aviso ${vista.estado === 'faltante' ? 'aviso--error' : vista.estado === 'sobrante' ? '' : 'aviso--neutro'}`}>
        <div className="aviso__mensaje">
          <span className="aviso__titulo">{textoEstado(vista)}</span>
        </div>
      </div>

      <article className="tarjeta">
        <div className="dato"><span className="dato__etiqueta">Vendido</span><span className="dato__total">{formatoPesos(vista.vendido)}</span></div>
        <div className="division" />
        <div className="dato"><span className="dato__etiqueta">Efectivo</span><span className="dato__valor">{formatoPesos(vista.efectivo)}</span></div>
        <div className="dato"><span className="dato__etiqueta">Transferencias</span><span className="dato__valor">{formatoPesos(vista.transferencias)}</span></div>
        <div className="dato"><span className="dato__etiqueta">Deudas</span><span className="dato__valor" data-dato="deudas">{formatoPesos(vista.deudas)}</span></div>
        <div className="dato"><span className="dato__etiqueta">Dinero total</span><span className="dato__valor" data-dato="dinero-total">{formatoPesos(vista.dineroTotal)}</span></div>
      </article>

      {s !== null && s.completo && (
        <article className="tarjeta tarjeta--destacada">
          <div className="dato"><span className="dato__etiqueta">Utilidad esperada</span><span className="dato__valor">{formatoPesos(s.utilidadEsperada)}</span></div>
          <div className="dato"><span className="dato__etiqueta">Utilidad real</span><span className="dato__valor">{formatoPesos(s.utilidadReal ?? 0)}</span></div>
          <div className="dato">
            <span className="dato__etiqueta">Diferencia</span>
            <span className={`dato__valor${(s.diferenciaUtilidad ?? 0) < 0 ? ' dato__valor--negativo' : ''}`}>{firmado(s.diferenciaUtilidad ?? 0)}</span>
          </div>
          <div className="dato"><span className="dato__etiqueta">Costo de reposición</span><span className="dato__valor">{formatoPesos(s.costoReposicion)}</span></div>
          <p className="texto-suave">{s.comprasUsadas} {s.comprasUsadas === 1 ? 'compra usada' : 'compras usadas'} como costo</p>
        </article>
      )}

      {s !== null && !s.completo && (
        <>
          <div className="aviso">
            <div className="aviso__mensaje">
              <span className="aviso__titulo">Cierre incompleto</span>
              <span>Hay productos vendidos sin costo. No se calcula la utilidad real.</span>
            </div>
          </div>
          <article className="tarjeta">
            <div className="dato"><span className="dato__etiqueta">Utilidad esperada (solo con costo)</span><span className="dato__valor">{formatoPesos(s.utilidadEsperada)}</span></div>
            <div className="dato"><span className="dato__etiqueta">Vendido sin costo</span><span className="dato__valor" data-dato="sin-costo">{formatoPesos(s.ventasSinCosto)}</span></div>
            <ul className="lista-simple">
              {s.productosSinCosto.map((p) => <li key={p.id}>{p.nombre}</li>)}
            </ul>
          </article>
        </>
      )}
    </>
  )
}
