/**
 * Pantalla "Cierres" (historial).
 *
 * Qué hace: lista los cierres diarios y semanales con su periodo, si
 * cuadraron y si están desactualizados, y da acceso a cerrar un día o una
 * semana y al detalle de cada cierre.
 * Cómo lo hace: carga cierres y la lista de desactualizados; `resumirCierres`
 * (aplicacion) arma las tarjetas.
 * Por qué: un cierre queda desactualizado si después se anuló o corrigió algo
 * que usó; verlo aquí permite recalcularlo, siempre a pedido de un usuario.
 */
import { useCallback, useMemo, useState } from 'react'
import { resumirCierres, type FiltroCierres } from '../../aplicacion/historialCierres'
import type { DetectorDesactualizados } from '../../aplicacion/cierresDesactualizados'
import type { RepositorioCierres } from '../../datos/cierres'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { Opciones } from '../componentes/Opciones'
import { fechaCorta, formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosCierresPantalla {
  cierres: Pick<RepositorioCierres, 'listarCierres'>
  desactualizados: DetectorDesactualizados
}

interface Propiedades {
  servicios: ServiciosCierresPantalla
  alIr: (ruta: string) => void
}

const FILTROS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'diario', etiqueta: 'Diarios' },
  { valor: 'semanal', etiqueta: 'Semanales' },
] as const

export function Cierres({ servicios, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [cierres, ids] = await Promise.all([servicios.cierres.listarCierres(), servicios.desactualizados.idsDesactualizados()])
    return { cierres, ids }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [filtro, setFiltro] = useState<FiltroCierres>('todos')
  const tarjetas = useMemo(() => (datos === null ? null : resumirCierres(datos.cierres, datos.ids, filtro)), [datos, filtro])

  const cabecera = <CabeceraInterna titulo="Cierres" subtitulo="Historial de cuadres" alVolver={() => alIr('mas')} />
  if (tarjetas === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="los cierres" reintentar={recargar} />
        </div>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <div className="acciones">
          <button type="button" className="boton boton--primario" onClick={() => alIr('cierres/diario')}>Cerrar día</button>
          <button type="button" className="boton boton--primario" onClick={() => alIr('cierres/semanal')}>Cerrar semana</button>
        </div>
        <Opciones nombre="Tipo de cierre" opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />

        {tarjetas.length === 0 && <p className="estado">Todavía no hay cierres.</p>}
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className="tarjeta tarjeta--boton" onClick={() => alIr(`mas/cierres/${t.id}`)}>
            <span className="tarjeta__cabecera">
              <span className="renglones__descripcion">{t.titulo}</span>
              {t.desactualizado && <span className="estado-etiqueta estado-etiqueta--negativo">Desactualizado</span>}
            </span>
            <span className="texto-suave">{t.tipo === 'diario' ? fechaCorta(t.desde) : `${fechaCorta(t.desde)} – ${fechaCorta(t.hasta)}`}</span>
            <span className="dato">
              <span className="dato__etiqueta">
                {t.estado === 'faltante' ? `Faltante de ${formatoPesos(t.monto)}` : t.estado === 'sobrante' ? `Sobrante de ${formatoPesos(t.monto)}` : 'Cuadra'}
              </span>
              <span className="dato__valor">{formatoPesos(t.dineroTotal)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
