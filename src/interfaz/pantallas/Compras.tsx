/**
 * Pantalla "Compras" (historial de abastecimiento).
 *
 * Qué hace: lista las compras de un periodo (con filtro Todas, Vigentes o
 * Anuladas) con su número, producto, cantidad, costo por unidad y total;
 * permite ir a corregir el costo o anular una compra con motivo.
 * Cómo lo hace: carga compras, productos y bitácora; `resumirCompras` arma lo
 * que se dibuja. Anular llama al repositorio y recarga la lista.
 * Por qué: nada se borra; una compra equivocada se anula con un motivo que
 * queda en la bitácora y su entrada a la bodega se compensa.
 */
import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { anulacionesDe } from '../../aplicacion/anulaciones'
import {
  periodoDeCompras,
  resumirCompras,
  type FiltroCompras,
  type OpcionPeriodoCompras,
  type TarjetaCompra,
} from '../../aplicacion/resumenCompras'
import type { RepositorioBitacora } from '../../datos/bitacora'
import type { RepositorioInventario } from '../../datos/inventario'
import { FormularioAnulacion } from '../componentes/FormularioAnulacion'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { Opciones } from '../componentes/Opciones'
import { fechaCompleta, formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosCompras {
  inventario: Pick<RepositorioInventario, 'listarCompras' | 'listarProductos' | 'anularCompra'>
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
}

interface Propiedades {
  servicios: ServiciosCompras
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'vigentes', etiqueta: 'Vigentes' },
  { valor: 'anuladas', etiqueta: 'Anuladas' },
] as const

const PERIODOS = [
  { valor: '7', etiqueta: 'Últimos 7 días' },
  { valor: '30', etiqueta: 'Últimos 30 días' },
  { valor: 'todo', etiqueta: 'Todo el historial' },
] as const

/** Una compra. */
function Tarjeta({
  tarjeta,
  anulando,
  alCorregir,
  alAnular,
  alConfirmar,
  alCancelar,
}: {
  tarjeta: TarjetaCompra
  anulando: boolean
  alCorregir: () => void
  alAnular: () => void
  alConfirmar: (motivo: string) => Promise<void>
  alCancelar: () => void
}) {
  const vigente = tarjeta.estado === 'vigente'
  return (
    <article className="tarjeta">
      <div className="tarjeta__cabecera">
        <span className="tarjeta__identificacion">{tarjeta.numero} · {fechaCompleta(tarjeta.fecha)}</span>
        <span className={`estado-etiqueta ${vigente ? 'estado-etiqueta--vigente' : 'estado-etiqueta--anulada'}`}>
          {vigente ? 'Vigente' : 'Anulada'}
        </span>
      </div>
      <p className="renglones__descripcion">{tarjeta.producto}</p>
      <p className="texto-suave">{tarjeta.cantidadTexto}</p>
      <div className="dato">
        <span className="dato__etiqueta">{formatoPesos(tarjeta.costoPorUnidad)} / unidad</span>
        <span className="dato__total">{formatoPesos(tarjeta.total)}</span>
      </div>
      {vigente && !anulando && (
        <div className="acciones">
          <button type="button" className="boton" onClick={alCorregir}>Corregir costo</button>
          <button type="button" className="boton boton--peligro-texto" onClick={alAnular}>Anular</button>
        </div>
      )}
      {vigente && anulando && <FormularioAnulacion titulo="Anular compra" alConfirmar={alConfirmar} alCancelar={alCancelar} />}
      {tarjeta.anulacion !== null && <p className="texto-suave">Motivo: {tarjeta.anulacion.motivo}</p>}
    </article>
  )
}

export function Compras({ servicios, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [compras, productos, entradas] = await Promise.all([
      servicios.inventario.listarCompras(),
      servicios.inventario.listarProductos(),
      servicios.bitacora.listarBitacora(),
    ])
    return { compras, productos, entradas }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)

  const [periodo, setPeriodo] = useState<OpcionPeriodoCompras>('7')
  const [filtro, setFiltro] = useState<FiltroCompras>('todas')
  const [anulando, setAnulando] = useState<string | null>(null)

  const tarjetas = useMemo(() => {
    if (datos === null) return null
    return resumirCompras({
      compras: datos.compras,
      nombres: new Map(datos.productos.map((p) => [p.id, p.nombre])),
      anulaciones: anulacionesDe(datos.entradas, 'compras'),
      ...periodoDeCompras(periodo, hoy),
      filtro,
    })
  }, [datos, periodo, hoy, filtro])

  const cabecera = <CabeceraInterna titulo="Compras" subtitulo="Historial de abastecimiento" alVolver={() => alIr('mas')} />
  if (tarjetas === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="las compras" reintentar={recargar} />
        </div>
      </>
    )
  }

  const anular = async (compraId: string, motivo: string) => {
    await servicios.inventario.anularCompra(compraId, motivo)
    setAnulando(null)
    recargar()
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <button type="button" className="boton boton--primario" onClick={() => alIr('inventario/comprar')}>
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" /> Nueva compra
        </button>
        <ListaDesplegable
          etiqueta="Periodo"
          valor={periodo}
          opciones={PERIODOS}
          alCambiar={(v) => setPeriodo(v as OpcionPeriodoCompras)}
        />
        <Opciones nombre="Estado" opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />

        {tarjetas.length === 0 && <p className="estado">No hay compras en este periodo.</p>}
        {tarjetas.map((t) => (
          <Tarjeta
            key={t.id}
            tarjeta={t}
            anulando={anulando === t.id}
            alCorregir={() => alIr(`mas/compras/corregir/${t.id}`)}
            alAnular={() => setAnulando(t.id)}
            alConfirmar={(motivo) => anular(t.id, motivo)}
            alCancelar={() => setAnulando(null)}
          />
        ))}
      </div>
    </>
  )
}
