/**
 * Pantalla "Detalle de la bitácora".
 *
 * Qué hace: muestra una entrada de la bitácora: qué pasó, quién, cuándo, el
 * motivo y, campo por campo, cómo estaba y cómo quedó el registro.
 * Cómo lo hace: carga la bitácora, busca la entrada por id y `comparar`
 * (aplicacion) arma los cambios con nombres y valores legibles.
 * Por qué: es la evidencia de una corrección o anulación; mostrar solo lo que
 * cambió evita buscar la diferencia a ojo.
 */
import { useCallback } from 'react'
import { comparar, tituloDe } from '../../aplicacion/resumenBitacora'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { useCarga } from '../useCarga'
import type { ServiciosBitacora } from './Bitacora'
import { momentoLocal } from '../formato'

interface Propiedades {
  servicios: ServiciosBitacora
  entradaId: string | undefined
  alIr: (ruta: string) => void
}

export function DetalleBitacora({ servicios, entradaId, alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.bitacora.listarBitacora(), [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)

  const cabecera = <CabeceraInterna titulo="Detalle" subtitulo="Antes y después" alVolver={() => alIr('mas/bitacora')} />
  if (estado !== 'listo' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="la bitácora" reintentar={recargar} />
        </div>
      </>
    )
  }
  const entrada = datos.find((e) => e.id === entradaId)
  if (entrada === undefined) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">Esa entrada no existe.</span>
          <button type="button" className="boton" onClick={() => alIr('mas/bitacora')}>Volver a la bitácora</button>
        </div>
      </>
    )
  }

  const cambios = comparar(entrada.antes, entrada.despues)
  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <article className="tarjeta">
          <span className="renglones__descripcion">{tituloDe(entrada)}</span>
          <span className="texto-suave">{momentoLocal(entrada.momento)}</span>
          <span>{entrada.usuario}</span>
          {entrada.motivo !== null && (
            <>
              <span className="campo__etiqueta">Motivo</span>
              <span>{entrada.motivo}</span>
            </>
          )}
        </article>

        {cambios.length === 0 && <p className="estado">No hay cambios para mostrar.</p>}
        {cambios.map((c) => (
          <article key={c.campo} className="tarjeta">
            <span className="campo__etiqueta">{c.campo}</span>
            <div className="dato"><span className="dato__etiqueta">Antes</span><span className="dato__valor">{c.antes}</span></div>
            <div className="dato"><span className="dato__etiqueta">Después</span><span className="dato__valor">{c.despues}</span></div>
          </article>
        ))}
      </div>
    </>
  )
}
