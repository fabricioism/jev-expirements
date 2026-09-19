# Chat Lab: guía técnica

El [README principal](../../README.md) explica el experimento, cómo ejecutarlo y una conversación de prueba. Esta guía describe la implementación y cómo interpretar sus datos técnicos.

## Flujo de un turno

1. React envía el recorrido seleccionado, el conocimiento completo y el historial al backend Hono.
2. En **Solo Gemini**, el backend pide a Gemini una respuesta y una acción.
3. En **Gemini + Jev**, el backend consulta primero a Jev. Envía la intención y acción elegidas a Gemini para que redacte la respuesta.
4. El backend valida el formato y comprueba que Gemini respete la acción de Jev. Devuelve el texto, las decisiones y las métricas al navegador.

Modelos definidos en [`src/shared.ts`](src/shared.ts):

| Función | Modelo | Endpoint de OpenRouter |
| --- | --- | --- |
| Redacción | `google/gemini-3.7-flash` | `POST /api/v1/chat/completions` |
| Decisiones | `typesafe/jev-1.13` | `POST /api/alpha/decisions` |

Las instrucciones están en [`src/server/openrouter.ts`](src/server/openrouter.ts). Ambos modos usan Gemini con `temperature: 0.3`, reasoning `low` y hasta `4096` tokens de salida. El modo combinado añade al contexto la decisión de Jev.

## Qué decide Jev

Una llamada contiene dos preguntas independientes de tipo [`Choice`](https://docs.typesafe.ai/primitives/choice): intención principal y siguiente acción. Cada pregunta recibe el contexto necesario; ninguna lee la respuesta de la otra.

| Acción | Significado en esta demo |
| --- | --- |
| `reply` | Responder con el conocimiento disponible |
| `clarify` | Pedir un dato del cliente necesario para entender la solicitud |
| `handoff` | Solicitar atención humana por petición del cliente, datos empresariales ausentes o contradictorios, u operaciones que requieren confirmación |

Las probabilidades y la confianza se muestran para inspección. No hay un umbral de confianza que active la derivación: la determina la acción elegida. La validación del backend comprueba estructura y coherencia de la acción, sin verificar las afirmaciones de la respuesta.

Las instrucciones de Jev están en inglés. Los ejemplos mantienen el español y el portugués de Brasil. [TypeSafe indica](https://docs.typesafe.ai/models#language-support) que el inglés es su principal idioma de entrenamiento y donde obtiene mayor precisión. La utilidad en estos ejemplos debe comprobarse con conversaciones en sus idiomas.

## Historial, conocimiento y métricas

- **Chats en paralelo:** cada modo conserva su propio historial. Ambos reciben el mismo mensaje nuevo, conocimiento e instante de referencia.
- **Un chat:** conserva una conversación independiente del modo paralelo. El modo se elige antes del primer mensaje.
- **Estado:** las conversaciones se separan por recorrido. Las ediciones pertenecen al negocio; huéspedes y propietarios comparten el conocimiento de Saira.
- **Memoria:** React conserva el estado. No se escribe en `localStorage` ni en una base de datos. Recargar restaura los ejemplos.
- **Inspector:** en paralelo permite revisar cada turno. Muestra el historial y conocimiento enviados por el navegador, además del resultado procesado por el backend. Los prompts completos están en el código.
- **Tokens:** unidades de texto que procesa el modelo. Entrada incluye el contexto enviado; salida corresponde a lo generado. Se muestran los conteos que informa OpenRouter.
- **Costos:** se leen de `usage.cost` de OpenRouter. El total suma Gemini y Jev solo cuando están informados todos los costos necesarios. No incluye intentos fallidos ni representa el gasto total de la cuenta.
- **Tiempos:** el backend mide las llamadas al proveedor y el turno completo. El tiempo total de la interfaz puede ser mayor por la conexión entre navegador y backend.

Si falla un modo, el otro conserva su resultado. Reintentar consulta solo los modos fallidos con el historial y conocimiento del intento original. Jev nunca se sustituye silenciosamente por otro modelo. Cada llamada al proveedor tiene un timeout de 60 segundos; el modo combinado ejecuta dos llamadas sucesivas.

## Conocimiento y límites

Los textos iniciales viven en [`knowledge/`](knowledge/). El backend los carga completos; no hay extracción de documentos, embeddings, RAG ni consultas web durante el chat.

El Grano de Oro y BestSign contienen datos ficticios. Saira incluye fuentes públicas y fecha de consulta. Sus precios no se actualizan automáticamente.

| Límite | Valor |
| --- | --- |
| Conocimiento editable | 16,000 caracteres |
| Mensaje del cliente | 2,000 caracteres |
| Historial enviado por modo | 40 mensajes, contando cliente y agente |
| Contexto serializado por modo | 24,000 bytes |

El backend rechaza solicitudes que superan esos límites. No recorta silenciosamente el conocimiento ni el historial. Acorta el texto o reinicia el chat si aparece el aviso de contexto lleno.

## Configuración y comandos

Ejecuta los comandos desde la raíz del repositorio:

| Comando | Función |
| --- | --- |
| `pnpm dev:chat-lab` | Inicia Vite en `127.0.0.1:4317` y la API en `127.0.0.1:4318` |
| `pnpm check:chat-lab` | Revisa los tipos de TypeScript |
| `pnpm build:chat-lab` | Revisa los tipos y genera el frontend en `apps/chat-lab/dist` |
| `pnpm start:chat-lab` | Sirve la API y el frontend compilado en `http://127.0.0.1:4318` |

Ejecuta `pnpm build:chat-lab` antes de `pnpm start:chat-lab`. Los servidores escuchan en `127.0.0.1` para esta prueba local.

La configuración recomendada es `apps/chat-lab/.env`, copiado de [`.env.example`](.env.example). Para cambiar puertos, edita allí `CHAT_LAB_WEB_PORT` y `CHAT_LAB_API_PORT`. Reinicia el proceso de desarrollo después de cambiar el archivo.

El backend también admite `OPENROUTER_API_KEY` en el `.env` de la raíz. Prioridad: entorno del proceso, archivo de la app y archivo de la raíz. Si usas el de la raíz, elimina `OPENROUTER_API_KEY=` del archivo de la app; una línea vacía impide usar el valor de la raíz. Los puertos de Vite se configuran en el archivo de la app.

## Si algo falla al arrancar

| Lo que ves | Qué comprobar |
| --- | --- |
| `pnpm` no existe o falla la instalación | Revisa `node --version` y `pnpm --version`. Se requieren Node.js 24 o superior y pnpm 11.26.0. |
| «Falta la API key» | Completa `OPENROUTER_API_KEY` en el archivo indicado, reinicia y recarga la página. |
| Key configurada, pero OpenRouter la rechaza | El indicador solo comprueba que existe un valor. Revisa que la key siga vigente y tenga acceso a los modelos. |
| Saldo insuficiente o límite de solicitudes | Comprueba tu cuenta de OpenRouter. Espera antes de reintentar si el proveedor limita las solicitudes. |
| Puerto ocupado | Detén otra instancia o cambia los puertos en el `.env` de la app. |
| Modelo o endpoint no disponible | Comprueba la disponibilidad en OpenRouter. La app muestra el error y no cambia de modelo automáticamente. |
| Se detuvo **Un chat** tras pedir una persona | Es el comportamiento de la derivación simulada. Reinicia o usa **Chats en paralelo** para seguir experimentando. |

## Estructura y API local

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| [`src/server/cases.ts`](src/server/cases.ts) | Negocios, recorridos y mensajes sugeridos |
| [`src/server/index.ts`](src/server/index.ts) | Configuración y rutas Hono |
| [`src/server/openrouter.ts`](src/server/openrouter.ts) | Prompts, llamadas y validación de respuestas |
| [`src/shared.ts`](src/shared.ts) | Contratos, modelos y límites |
| [`src/web/`](src/web/) | Interfaz React e inspectores |
| [`knowledge/`](knowledge/) | Conocimiento inicial de cada negocio |

| Ruta | Entrada y resultado |
| --- | --- |
| `GET /api/config` | Casos, modelos, límites y presencia de la key. Nunca devuelve su valor. |
| `POST /api/chat` | Recibe `{ scenarioId, knowledge, messages, mode }`. Devuelve respuesta, acción, decisiones, tiempos, consumo y modelos efectivos. |
| `POST /api/parallel-chat` | Recibe `{ scenarioId, knowledge, histories: { solo, jev }, modes }`. Devuelve un resultado por modo solicitado. `modes` permite reintentar solo el que falló. |
| `POST /api/compare` | Recibe `{ scenarioId, knowledge, messages }`. Compara un turno con historial idéntico y devuelve `{ solo, jev }`. Está disponible para pruebas por API; la interfaz usa `/api/parallel-chat`. |

En las dos rutas de comparación, cada modo devuelve `{ ok: true, result }` o `{ ok: false, error }`. Los mensajes alternan `user` y `assistant`, y el último debe ser `user`.

La API envía al proveedor el negocio, objetivo, instrucciones, conocimiento e historial correspondientes al recorrido. No envía los otros negocios ni las otras conversaciones.

Consulta la [referencia de OpenRouter Decisions](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request) para el contrato del proveedor.
