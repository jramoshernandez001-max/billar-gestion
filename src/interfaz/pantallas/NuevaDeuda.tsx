/**
 * Pantalla "Nueva deuda".
 *
 * Qué hace: registra una deuda (alguien se llevó producto sin pagar) con
 * fecha, cliente, monto y una descripción obligatoria.
 * Cómo lo hace: `validarDeuda` (aplicacion) limpia y valida los campos y
 * entrega los datos; al guardar llama al repositorio y vuelve a la lista.
 * Por qué: la descripción justifica el movimiento y queda en la bitácora; la
 * deuda entra al cierre del día en que nació por lo que siga debiendo.
 */
import { useState } from 'react'
import { validarDeuda, type EntradaDeuda } from '../../aplicacion/formulariosDeuda'
import type { RepositorioDeudas } from '../../datos/deudas'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'

/** Servicios que necesita la pantalla. */
export interface ServiciosNuevaDeuda {
  deudas: Pick<RepositorioDeudas, 'registrarDeuda'>
}

interface Propiedades {
  servicios: ServiciosNuevaDeuda
  hoy: string
  alIr: (ruta: string) => void
}

export function NuevaDeuda({ servicios, hoy, alIr }: Propiedades) {
  const [fecha, setFecha] = useState(hoy)
  const [entrada, setEntrada] = useState<EntradaDeuda>({ cliente: '', monto: '', descripcion: '' })
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaDeuda, true>>>({})
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const resultado = validarDeuda(entrada, fecha)
  const cambiar = (campo: keyof EntradaDeuda, valor: string) => {
    setEntrada((e) => ({ ...e, [campo]: campo === 'monto' ? valor.replace(/\D/g, '') : valor }))
    setTocados((t) => ({ ...t, [campo]: true }))
  }
  const error = (campo: keyof EntradaDeuda) => (tocados[campo] ? resultado.errores[campo] : undefined)

  const guardar = async () => {
    if (resultado.datos === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.deudas.registrarDeuda(resultado.datos)
      alIr('deudas')
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  return (
    <>
      <CabeceraInterna titulo="Nueva deuda" subtitulo="Producto entregado sin pagar" alVolver={() => alIr('deudas')} />
      <div className="marco__contenido">
        <CampoFecha valor={fecha} hoy={hoy} alCambiar={setFecha} />
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="cliente-deuda">Cliente</label>
          <div className="entrada">
            <input id="cliente-deuda" type="text" className="entrada__control" value={entrada.cliente} onChange={(e) => cambiar('cliente', e.target.value)} />
          </div>
          {error('cliente') !== undefined && <span className="texto-error">{error('cliente')}</span>}
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="monto-deuda">Monto</label>
          <div className="entrada">
            <input id="monto-deuda" type="text" inputMode="numeric" className="entrada__control" placeholder="$ 0" value={entrada.monto} onChange={(e) => cambiar('monto', e.target.value)} />
          </div>
          {error('monto') !== undefined && <span className="texto-error">{error('monto')}</span>}
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="descripcion-deuda">Descripción</label>
          <textarea id="descripcion-deuda" className="entrada entrada--texto" rows={3} value={entrada.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
          {error('descripcion') !== undefined && <span className="texto-error">{error('descripcion')}</span>}
        </div>

        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        <button type="button" className="boton boton--primario" disabled={!resultado.puedeGuardar || enviando} onClick={guardar}>
          Guardar deuda
        </button>
      </div>
    </>
  )
}
