/**
 * Pantalla principal de la app.
 *
 * Qué hace: envuelve todo en el control de acceso (solo un usuario autorizado
 * ve algo) y, dentro, elige la pantalla según la ruta y dibuja la navegación
 * inferior.
 * Cómo lo hace: recibe el servicio de acceso y los servicios de datos ya
 * construidos; lee la ruta con useRuta y muestra la pantalla que le toca (las
 * que aún no están listas muestran "en construcción").
 * Por qué: recibir los servicios por propiedad evita que App conozca a
 * Supabase y permite probarla con servicios falsos.
 */
import { useState } from 'react'
import { ControlDeAcceso } from './autenticacion/ControlDeAcceso'
import type { ServicioAcceso } from './autenticacion/servicioAcceso'
import type { ServiciosInicio } from './aplicacion/cargarInicio'
import { NavegacionInferior } from './interfaz/componentes/NavegacionInferior'
import { fechaLocalIso } from './interfaz/formato'
import { AjustarStock, type ServiciosAjustar } from './interfaz/pantallas/AjustarStock'
import { Comprar, type ServiciosComprar } from './interfaz/pantallas/Comprar'
import { Compras, type ServiciosCompras } from './interfaz/pantallas/Compras'
import { CorregirCosto, type ServiciosCorregirCosto } from './interfaz/pantallas/CorregirCosto'
import { Cerrar, type ServiciosCerrar } from './interfaz/pantallas/Cerrar'
import { Cierres, type ServiciosCierresPantalla } from './interfaz/pantallas/Cierres'
import { DetalleCierre, type ServiciosDetalleCierre } from './interfaz/pantallas/DetalleCierre'
import { Abonar, type ServiciosAbonar } from './interfaz/pantallas/Abonar'
import { DetalleDeuda, type ServiciosDetalleDeuda } from './interfaz/pantallas/DetalleDeuda'
import { Deudas, type ServiciosDeudas } from './interfaz/pantallas/Deudas'
import { NuevaDeuda, type ServiciosNuevaDeuda } from './interfaz/pantallas/NuevaDeuda'
import { FormularioProducto, type ServiciosFormularioProducto } from './interfaz/pantallas/FormularioProducto'
import { Productos, type ServiciosProductos } from './interfaz/pantallas/Productos'
import { Inicio } from './interfaz/pantallas/Inicio'
import { Inventario, type ServiciosInventario } from './interfaz/pantallas/Inventario'
import { Trasladar, type ServiciosTrasladar } from './interfaz/pantallas/Trasladar'
import { Proximamente } from './interfaz/pantallas/Proximamente'
import { Vender, type ServiciosVender } from './interfaz/pantallas/Vender'
import { Ventas, type ServiciosVentas } from './interfaz/pantallas/Ventas'
import { pestanaDe, segmentosDeRuta } from './interfaz/ruta'
import { useRuta } from './interfaz/useRuta'

/** Servicios de datos que usan las pantallas (crece con cada pantalla). */
export type ServiciosApp = ServiciosInicio &
  ServiciosVender &
  ServiciosVentas &
  ServiciosInventario &
  ServiciosTrasladar &
  ServiciosAjustar &
  ServiciosComprar &
  ServiciosCompras &
  ServiciosCorregirCosto &
  ServiciosProductos &
  ServiciosFormularioProducto &
  ServiciosDeudas &
  ServiciosNuevaDeuda &
  ServiciosAbonar &
  ServiciosDetalleDeuda &
  ServiciosCerrar &
  ServiciosCierresPantalla &
  ServiciosDetalleCierre

interface Propiedades {
  servicio: ServicioAcceso
  servicios: ServiciosApp
}

/**
 * Elige la pantalla de una ruta.
 *
 * Qué hace: devuelve la pantalla que corresponde; las que aún no están
 * listas muestran "en construcción".
 * Cómo lo hace: un `switch` sobre el texto de la ruta.
 * Por qué: un solo lugar donde se ve qué rutas existen.
 */
function pantalla(ruta: string, servicios: ServiciosApp, nombre: string | undefined, hoy: string, ir: (ruta: string) => void) {
  // Tramos de la ruta: sección/acción/tercero/cuarto (ids o subacciones).
  const [seccion, accion, tercero, cuarto] = segmentosDeRuta(ruta)
  if (seccion === 'cierres' && (accion === 'diario' || accion === 'semanal')) {
    return <Cerrar servicios={servicios} tipo={accion} hoy={hoy} alIr={ir} />
  }
  if (seccion === 'mas' && accion === 'cierres' && tercero !== undefined) {
    return <DetalleCierre servicios={servicios} cierreId={tercero} alIr={ir} />
  }
  if (seccion === 'deudas' && accion === 'nueva') return <NuevaDeuda servicios={servicios} hoy={hoy} alIr={ir} />
  if (seccion === 'deudas' && accion === 'abonar') return <Abonar servicios={servicios} deudaId={tercero} hoy={hoy} alIr={ir} />
  if (seccion === 'deudas' && accion !== undefined) return <DetalleDeuda servicios={servicios} deudaId={accion} hoy={hoy} alIr={ir} />
  if (seccion === 'inventario' && accion === 'editar') {
    return <FormularioProducto servicios={servicios} productoId={tercero} volverA="inventario" alIr={ir} />
  }
  if (seccion === 'mas' && accion === 'productos' && tercero === 'nuevo') {
    return <FormularioProducto servicios={servicios} alIr={ir} />
  }
  if (seccion === 'mas' && accion === 'productos' && tercero === 'editar') {
    return <FormularioProducto servicios={servicios} productoId={cuarto} alIr={ir} />
  }
  if (seccion === 'inventario' && accion === 'comprar') {
    return <Comprar servicios={servicios} productoId={tercero} hoy={hoy} alIr={ir} />
  }
  if (seccion === 'mas' && accion === 'compras' && tercero === 'corregir') {
    return <CorregirCosto servicios={servicios} compraId={cuarto} alIr={ir} />
  }
  if (seccion === 'inventario' && accion === 'trasladar') {
    return <Trasladar servicios={servicios} productoId={tercero} alIr={ir} />
  }
  if (seccion === 'inventario' && accion === 'ajustar') {
    return <AjustarStock servicios={servicios} productoId={tercero} alIr={ir} />
  }
  switch (ruta) {
    case 'inventario':
      return <Inventario servicios={servicios} alIr={ir} />
    case 'inicio':
      return <Inicio servicios={servicios} nombre={nombre} hoy={hoy} alIr={ir} />
    case 'vender':
      return <Vender servicios={servicios} hoy={hoy} alIr={ir} />
    case 'mas/cierres':
      return <Cierres servicios={servicios} alIr={ir} />
    case 'deudas':
      return <Deudas servicios={servicios} hoy={hoy} alIr={ir} />
    case 'mas/productos':
      return <Productos servicios={servicios} alIr={ir} />
    case 'mas/compras':
      return <Compras servicios={servicios} hoy={hoy} alIr={ir} />
    case 'mas/ventas':
      return <Ventas servicios={servicios} hoy={hoy} alIr={ir} />
    default:
      return <Proximamente ruta={ruta} />
  }
}

/** Contenido de la app para un usuario autorizado: pantalla + navegación. */
function Contenido({ nombre, servicios }: { nombre?: string; servicios: ServiciosApp }) {
  const { ruta, ir } = useRuta()
  const [hoy] = useState(() => fechaLocalIso(new Date()))
  return (
    <>
      {pantalla(ruta, servicios, nombre, hoy, ir)}
      <NavegacionInferior activa={pestanaDe(ruta)} alIr={ir} />
    </>
  )
}

function App({ servicio, servicios }: Propiedades) {
  return (
    <div className="marco">
      <ControlDeAcceso servicio={servicio} redirigirA={window.location.origin}>
        {({ nombre }) => <Contenido nombre={nombre} servicios={servicios} />}
      </ControlDeAcceso>
    </div>
  )
}

export default App
