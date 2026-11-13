# Mapas y pines

La configuración está en `src/config/maps.js`. Los planos JPG se sirven desde `public/maps/`; el formato `.jpg` funciona igual que PNG y `src` debe conservar exactamente el nombre y las mayúsculas del archivo. Las coordenadas se expresan en porcentajes respecto al ancho y alto de la imagen (0–100). El componente no recorta la imagen, así que pines y calibración usan la misma superficie.

## Agregar un mapa

1. Copia el JPG o PNG a `public/maps/`.
2. Agrega una entrada a `campusMaps` con `id` único, `src` (ej. `/maps/A_Piso1.jpg`), `name`, `description`, `priority` y `pins`.
3. El selector de “Explorar el mapa” lo mostrará automáticamente. Los 16 mapas actuales están registrados.

## Agregar o editar un pin

En la lista `pins` agrega un objeto con `id` (único dentro del mapa), `nodeId` (el `id` real del `NodoGrafo` asociado), `x`, `y` (porcentajes 0–100) y `label`. Para asociar el mismo nodo a más mapas, crea una entrada en cada mapa con las coordenadas correspondientes. No uses IDs de ejemplo: consulta el nodo real en `/api/grafo`. Para pines visuales de entradas, pasillos o escaleras que no existen en el grafo, usa `nodeId: null`; el visor de ruta los asocia por tipo, bloque/piso y contexto de la ruta, con overrides para los casos ambiguos.

Los tipos opcionales `style: 'normal' | 'activo' | 'origen' | 'destino'` permiten seleccionar el estilo del pin. `getMapLocationsByNodeId(nodeId)` en `src/lib/mapLocations.js` devuelve todas sus ubicaciones configuradas.

## Calibrar coordenadas

Abre la vista de explorar con `?debug=pins`, por ejemplo `/app/explorar?debug=pins`, y haz clic en el punto exacto del plano. La interfaz muestra `x` e `y` con cuatro decimales y permite copiarlos. Actualiza esa pareja en el pin correspondiente. La punta inferior del ícono queda anclada a esa coordenada. Activa “Mostrar etiquetas de todos los pines” para revisar simultáneamente las ubicaciones configuradas.

Si el plano no carga, revisa que el archivo exista en `public/maps/` y que el nombre de `src` coincida exactamente. Los mapas aparecen en el selector aunque `pins` esté vacío; en ese caso se ve el plano, pero todavía no hay pines que mostrar.

## Pines al buscar un destino (fase 2)

Al elegir un resultado de búsqueda, la app abre “¿Cómo llegar?” y busca el `nodeId` del espacio; si el espacio no tiene nodo propio, usa el nodo asociado a su bloque. Para puntos buscables usa directamente el ID del punto. El servicio `getMapLocationsByNodeId()` encuentra sus pines configurados y el mapa con mayor `priority` aparece primero (los pisos normalmente tienen prioridad mayor que el mapa general). Las pestañas permiten elegir otros mapas asociados al destino y mapas asociados al origen.

El QR de origen conserva su `nodoGrafoId` en la sesión al entrar desde el QR. En “¿Cómo llegar?” se muestra el pin asociado al paso activo; en el paso final solo se muestra la meta en verde. Los otros pines quedan ocultos para evitar saturar la ruta. En “Explorar el mapa”, sí puedes activar “Mostrar etiquetas de todos los pines” para ver el inventario completo. Si falta configuración, se muestra un aviso y, si existe, el mapa del origen queda disponible. Las rutas y la búsqueda siguen funcionando aunque no haya pin configurado.

La respuesta pública del espacio añade `nodoGrafoId` y `bloqueNodoGrafoId`, y la del QR incluye su relación `nodoGrafo`; estos campos solo conectan los datos existentes con el visor y no alteran el cálculo de rutas. Para el origen, vuelve a entrar desde el QR después de actualizar si la sesión se creó con una versión anterior.

## Mapa sincronizado con el paso activo (fase 3)

La API entrega `rutaDesdeQr` como una lista de textos, por ejemplo `['Dirígete hacia Bloque A.', 'Sube por la escalera hasta el piso 2.', 'Llega a Salón A302.']`. También añade `rutaNodosPorPaso` en las respuestas de espacios y puntos: el generador actual crea un paso por cada nodo después del QR de origen, por lo que ambos arreglos quedan alineados. Las rutas manuales no tienen esos IDs y entregan una lista vacía. El visor resuelve un paso por prioridad: (1) override manual por patrón o ID de nodo, (2) ubicación de pin ligada al nodo del paso, (3) pin visual de apoyo inferido por tipo, bloque y piso, (4) coincidencia de etiqueta de un pin asociado a un nodo. Si el paso no se resuelve, conserva la última ubicación válida; el paso final de un espacio usa el pin del destino como fallback.

Los overrides se configuran en `src/config/routeStepConfig.js`. Cada entrada tiene un `id`, una expresión regular `match` y `locations` con `mapId` y `pinId`; un paso puede asociar varios pines al mismo mapa. Para Entrada Bloque B → C302, la configuración referencia los IDs reales `entrada-b`, `pasillo-piso-1-c`, `escaleras-piso-3-c` y `pasillo-piso-3-c`. Para otras rutas, el visor infiere el mapa de escalera por el bloque actual y el piso indicado, y el pasillo por el mapa del tramo actual. Si el camino usa una escalera distinta en un mapa con varias opciones, agrega un override con el texto real de ese paso y el `pinId` correspondiente. El origen del tramo se distingue con `style: 'origen'`.

El mismo archivo incluye `sampleRoute` como ejemplo de texto. En rutas generadas desde el grafo, el frontend construye la asociación usando `rutaNodosPorPaso`; en rutas manuales, usa etiquetas de pines u overrides. El mapa elegido para cada paso tiene prioridad sobre las pestañas de origen/destino. Al avanzar o retroceder se restablece esa selección manual para que el paso vuelva a controlar el mapa.

La lista permite usar Anterior/Siguiente o seleccionar cualquier paso directamente, marca y desplaza el paso activo, y anuncia el cambio con `aria-live`. Se precargan los mapas del paso anterior y siguiente. `MapViewer` mantiene la imagen actual si no cambia el mapa y hace fade solo al cambiar la ruta de imagen; si la nueva imagen falla, conserva el último mapa válido. En una ruta solo se renderizan los pines asociados al paso activo; en el último paso, la meta se muestra en verde. El pin de paso usa `#48e9f7`. Los mapas de origen y destino pueden seguir disponibles en pestañas, pero sus pines no se añaden a la vista del paso.
