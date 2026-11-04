/**
 * Punto de entrada de la app.
 *
 * Qué hace: lee la configuración de Supabase, arma el servicio de acceso y
 * dibuja la app. Si la configuración falta o es inválida, muestra el motivo
 * en pantalla en vez de dejarla en blanco.
 * Cómo lo hace: compone las piezas en orden (configuración, cliente,
 * adaptador, servicio) y las entrega a App.
 * Por qué: es el único lugar donde se conectan las piezas reales; todo lo
 * demás recibe lo que necesita por parámetro y se prueba por separado.
 */
import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource-variable/inter'
import './interfaz/estilos.css'
import App from './App.tsx'
import { adaptarClienteSupabase, crearClienteSupabase } from './autenticacion/adaptadorSupabase'
import { crearServicioAcceso } from './autenticacion/servicioAcceso'
import { crearServicios } from './aplicacion/composicion'
import { adaptarClienteDatos } from './datos/adaptadorDatos'
import { leerConfiguracionSupabase } from './configuracion/supabase'

// Registra el service worker (modo instalable y archivos de la app sin conexión).
// Se actualiza solo cuando hay una versión nueva.
registerSW({ immediate: true })

const raiz = createRoot(document.getElementById('root')!)

try {
  const config = leerConfiguracionSupabase(import.meta.env)
  const supabase = crearClienteSupabase(config)
  const servicio = crearServicioAcceso(adaptarClienteSupabase(supabase))
  const servicios = crearServicios(adaptarClienteDatos(supabase))
  raiz.render(
    <StrictMode>
      <App servicio={servicio} servicios={servicios} />
    </StrictMode>,
  )
} catch (causa) {
  const mensaje = causa instanceof Error ? causa.message : String(causa)
  raiz.render(<p role="alert">La app no está configurada: {mensaje}</p>)
}
