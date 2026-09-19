# Experimentos con Jev

¿Qué aporta Jev a un chat de ventas que ya usa Gemini? Este repositorio permite probar esa pregunta con conversaciones completas.

El primer experimento, **Chat Lab**, simula a alguien que ve un anuncio en Instagram o Facebook y escribe al WhatsApp de un negocio. Tú interpretas al cliente. Los agentes responden usando el conocimiento del negocio, mientras un inspector muestra sus decisiones, tiempos y costos.

La hipótesis es que separar la decisión de la redacción puede ayudar a elegir cuándo responder, pedir un dato o solicitar atención humana. La demo permite observar si esa diferencia compensa la llamada adicional. Todavía no hay una conclusión sobre cuál modo funciona mejor.

## Qué hace cada modelo

Gemini escribe las respuestas en ambos modos. En este experimento, Jev elige la intención del mensaje y la siguiente acción entre opciones definidas.

| Modo | Quién elige la acción | Quién escribe la respuesta | Llamadas por turno |
| --- | --- | --- | --- |
| Solo Gemini | Gemini | Gemini | 1 a Gemini |
| Gemini + Jev | Jev | Gemini, siguiendo esa acción | 1 a Jev y después 1 a Gemini |

En **Chats en paralelo**, escribes una vez y recibes las dos respuestas. Cada agente continúa con su propio historial. En **Un chat**, eliges un modo y pruebas una conversación independiente.

El inspector muestra las decisiones y probabilidades de Jev. No muestra una explicación de su razonamiento ni verifica que la respuesta final sea verdadera.

## Los negocios de ejemplo

| Negocio | Qué puedes probar | Datos e idioma inicial |
| --- | --- | --- |
| **El Grano de Oro** | Precios, tamaños, sabores y condiciones de pedidos de pasteles | Ficticios, en español |
| **BestSign** | Planes de firma electrónica, documentos, usuarios e integraciones | Ficticios, en español |
| **Saira** | Consultas de huéspedes y servicios para propietarios | Fuentes públicas consultadas el 2026-09-19, en portugués de Brasil |

Puedes consultar y editar el conocimiento desde la interfaz. Saira conserva diferencias entre precios publicados para probar cómo responde el agente ante información contradictoria. Sus fuentes están en [el archivo de conocimiento](apps/chat-lab/knowledge/saira.md).

## Ejecutarlo en tu equipo

Necesitas:

- Node.js 24 o superior.
- pnpm 11.26.0. Si no lo tienes, consulta [su instalación](https://pnpm.io/installation).
- Una [API key de OpenRouter](https://openrouter.ai/settings/keys), saldo y acceso a `google/gemini-3.7-flash` y `typesafe/jev-1.13`.

Desde una terminal:

```sh
git clone https://github.com/fabricioism/jev-expirements.git
cd jev-expirements
pnpm install --frozen-lockfile
cp apps/chat-lab/.env.example apps/chat-lab/.env
```

Abre `apps/chat-lab/.env` y completa `OPENROUTER_API_KEY=` con tu key. Después ejecuta:

```sh
pnpm dev:chat-lab
```

Abre **http://127.0.0.1:4317** y deja la terminal en ejecución. Para detener la app, usa `Ctrl+C`.

Sin key puedes explorar los negocios y editar el conocimiento. Para recibir respuestas necesitas conectar OpenRouter. La app corre en tu equipo; la inferencia usa internet. El conocimiento y los mensajes del recorrido seleccionado se envían a OpenRouter. La key permanece en el servidor y los archivos `.env` están ignorados por Git.

## Tu primera prueba

Elige **El Grano de Oro** y **Chats en paralelo**. Envía estos mensajes, uno por turno:

| Mensaje | Qué observar |
| --- | --- |
| «Hola, vi su anuncio. ¿Cuánto cuesta un pastel para 16 personas?» | El catálogo indica HNL 850 como precio base. ¿Responde primero la pregunta? |
| «Mejor para 30 personas, de chocolate y con dulce de leche.» | El precio base cambia a HNL 1,450. ¿Respeta la corrección y recuerda los datos? |
| «¿Y cuánto cuesta con relleno de pistacho?» | Ese relleno no está documentado. ¿Reconoce el dato faltante o inventa una respuesta? |
| «Quiero hablar con una persona.» | ¿Elige atención humana y aclara que la derivación es simulada? |

Después:

1. Pulsa **Turno N** debajo de una respuesta. Compara la acción, el tiempo y los costos separados de Gemini y Jev.
2. Abre **Editar conocimiento**, cambia HNL 850 por HNL 900 y guarda el texto.
3. Pulsa **Reiniciar ambos** y vuelve a preguntar por 16 personas. El agente debe usar el precio editado.

Reiniciar limpia los chats del recorrido seleccionado y conserva el conocimiento editado. Recargar la página borra todas las conversaciones y ediciones.

## Cómo interpretar la comparación

- **Calidad:** revisa si usa los datos correctos, conserva las correcciones y pide atención humana cuando corresponde. Una respuesta más larga no implica una mejor respuesta.
- **Contexto:** ambos modos reciben el mismo mensaje y conocimiento. Desde el segundo turno, sus historiales difieren porque cada agente conserva sus propias respuestas.
- **Confianza:** las probabilidades describen la elección de Jev. Un porcentaje alto no demuestra que la decisión o el texto de Gemini sean correctos.
- **Costo:** cada turno paralelo completo usa 2 llamadas a Gemini y 1 a Jev. El inspector muestra USD por respuesta seleccionada, sin acumular la sesión ni los intentos anteriores. «No informado» significa que falta ese dato.
- **Conclusión:** prueba varios casos y registra tanto aciertos como errores. Un ejemplo aislado no permite afirmar que Jev mejora el chat o reduce costos.

Para compartir un hallazgo, incluye el negocio, los mensajes, cualquier edición del conocimiento y el turno que comparaste. Agrega lo que esperabas y lo que ocurrió.

## Alcance de esta demo

- Simula texto de chat. No conecta WhatsApp ni recibe mensajes de anuncios reales.
- La atención humana es simulada. En paralelo puedes seguir conversando; en **Un chat**, debes reiniciar después de esa decisión.
- No crea pedidos, reservas, firmas ni pagos. Tampoco consulta disponibilidad o precios en tiempo real.
- Envía todo el conocimiento como contexto, sin buscar fragmentos mediante RAG. No usa base de datos ni conserva la sesión al recargar.
- Es una prueba local sin autenticación. No incluye una evaluación automática de calidad ni una verificación adicional de las respuestas.

Cada experimento vive en `apps/`. Por ahora solo existe [Chat Lab](apps/chat-lab/README.md). Allí encontrarás el flujo técnico, los comandos de compilación y la solución de problemas de arranque.
