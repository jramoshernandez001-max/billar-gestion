/**
 * Pantalla "Ventas".
 *
 * Qué hace: lista las ventas de un día (con filtro Todas, Vigentes o
 * Anuladas), muestra cuántas son vigentes, sus unidades y su total, y permite
 * anular una venta indicando el motivo.
 * Cómo lo hace: carga ventas, productos y bitácora; `resumirVentas` arma lo
 * que se dibuja. Anular llama al repositorio y recarga la lista.
 * Por qué: nada se borra; una venta mal registrada se anula con un motivo que
 * queda en la bitácora. El diseño no trae la ventana para escribir el motivo;
 * por ahora se muestra un formulario dentro de la tarjeta, a la espera del
 * diseño de Figma.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  anulacionesDeVentas,
  resumirVentas,
  type FiltroVentas,
  type TarjetaVenta,
} from '../../aplicacion/resumenVentas'
import type { RepositorioBitacora } from '../../datos/bitacora'
import type { RepositorioInventario } from '../../datos/inventario'
import type { RepositorioVentas } from '../../datos/ventas'
import { FormularioAnulacion } from '../componentes/FormularioAnulacion'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'
import { Opciones } from '../componentes/Opciones'
import { fechaCompleta, formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosVentas {
  ventas: Pick<RepositorioVentas, 'listarVentas' | 'anularVenta'>
  inventario: Pick<RepositorioInventario, 'listarProductos'>
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
}

interface Propiedades {
  servicios: ServiciosVentas
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

/** Cuántas tarjetas se muestran de una vez. */
const PAGINA = 10

const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'vigentes', etiqueta: 'Vigentes' },
  { valor: 'anuladas', etiqueta: 'Anuladas' },
] as const

/** Una venta. */
function Tarjeta({
  tarjeta,
  anulando,
  alAnular,
  alConfirmar,
  alCancelar,
}: {
  tarjeta: TarjetaVenta
  anulando: boolean
  alAnular: () => void
  alConfirmar: (motivo: string) => Promise<void>
  alCancelar: () => void
}) {
  const vigente = tarjeta.estado === 'vigente'
  return (
    <article className="tarjeta">
      <div className="tarjeta__cabecera">
        <span className="tarjeta__identificacion">{tarjeta.numero} · {tarjeta.hora}</span>
        <span className={`estado-etiqueta ${vigente ? 'estado-etiqueta--vigente' : 'estado-etiqueta--anulada'}`}>
          {vigente ? 'Vigente' : 'Anulada'}
        </span>
      </div>
      <div className="renglones">
        {tarjeta.renglones.map((r, i) => (
          <div key={i} className="renglones__fila">
            <p className="renglones__descripcion">{r.descripcion}</p>
            <p className="texto-suave">{r.detalle}</p>
          </div>
        ))}
      </div>
      <div className="division" />
      <div className="dato">
        <span className="dato__etiqueta">Total</span>
        <span className="dato__valor">{formatoPesos(tarjeta.total)}</span>
      </div>
      {vigente && !anulando && (
        <button type="button" className="boton boton--peligro-texto" onClick={alAnular}>Anular</button>
      )}
      {vigente && anulando && <FormularioAnulacion alConfirmar={alConfirmar} alCancelar={alCancelar} />}
      {tarjeta.anulacion !== null && (
        <p className="texto-suave">Motivo: {tarjeta.anulacion.motivo} · {fechaCompleta(tarjeta.anulacion.fecha)}</p>
      )}
    </article>
  )
}

export function Ventas({ servicios, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [ventas, productos, entradas] = await Promise.all([
      servicios.ventas.listarVentas(),
      servicios.inventario.listarProductos(),
      servicios.bitacora.listarBitacora(),
    ])
    return { ventas, productos, entradas }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)

  const [fecha, setFecha] = useState(hoy)
  const [filtro, setFiltro] = useState<FiltroVentas>('todas')
  const [limite, setLimite] = useState(PAGINA)
  const [anulando, setAnulando] = useState<string | null>(null)

  const resumen = useMemo(() => {
    if (datos === null) return null
    return resumirVentas({
      ventas: datos.ventas,
      nombres: new Map(datos.productos.map((p) => [p.id, p.nombre])),
      anulaciones: anulacionesDeVentas(datos.entradas),
      fecha,
      filtro,
      limite,
    })
  }, [datos, fecha, filtro, limite])

  const cabecera = <CabeceraInterna titulo="Ventas" subtitulo="Movimientos del negocio" alVolver={() => alIr('mas')} />

  if (estado === 'cargando' && datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido"><p role="status" className="estado">Cargando…</p></div>
      </>
    )
  }
  if (resumen === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <div className="aviso aviso--error">
            <div className="aviso__mensaje">
              <span className="aviso__titulo">No se pudieron cargar las ventas</span>
              <span role="alert">{error}</span>
            </div>
          </div>
          <button type="button" className="boton" onClick={recargar}>Reintentar</button>
        </div>
      </>
    )
  }

  const anular = async (ventaId: string, motivo: string) => {
    await servicios.ventas.anularVenta(ventaId, motivo)
    setAnulando(null)
    recargar()
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <CampoFecha valor={fecha} hoy={hoy} alCambiar={(f) => { setFecha(f); setLimite(PAGINA) }} />
        <Opciones nombre="Estado" opciones={FILTROS} valor={filtro} alCambiar={(f) => { setFiltro(f); setLimite(PAGINA) }} />
        <div className="dato">
          <span className="dato__etiqueta">
            {resumen.vigentes} {resumen.vigentes === 1 ? 'vigente' : 'vigentes'} · {resumen.unidades} {resumen.unidades === 1 ? 'unidad' : 'unidades'}
          </span>
          <span className="dato__total">{formatoPesos(resumen.total)}</span>
        </div>

        {resumen.tarjetas.length === 0 && <p className="estado">No hay ventas en este día.</p>}
        {resumen.tarjetas.map((t) => (
          <Tarjeta
            key={t.id}
            tarjeta={t}
            anulando={anulando === t.id}
            alAnular={() => setAnulando(t.id)}
            alConfirmar={(motivo) => anular(t.id, motivo)}
            alCancelar={() => setAnulando(null)}
          />
        ))}

        {resumen.totalMovimientos > resumen.tarjetas.length && (
          <p className="texto-suave texto-centrado">
            <span>{resumen.tarjetas.length} de {resumen.totalMovimientos} movimientos</span> ·{' '}
            <button type="button" className="enlace" onClick={() => setLimite((l) => l + PAGINA)}>Cargar más</button>
          </p>
        )}
      </div>
    </>
  )
}
