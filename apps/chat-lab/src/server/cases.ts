import { readFileSync } from 'node:fs';
import type { BusinessCase, ScenarioId } from '../shared.ts';

const knowledge = (name: string) => readFileSync(new URL(`../../knowledge/${name}.md`, import.meta.url), 'utf8');

export const cases: BusinessCase[] = [
  {
    id: 'bakery', name: 'El Grano de Oro', category: 'Pastelería', description: 'De un anuncio a un pastel personalizado.', fictional: true, agentName: 'Sofi', knowledge: knowledge('el-grano-de-oro'), sources: [],
    scenarios: [{ id: 'bakery', label: 'Pedidos de pasteles', language: 'Español', goal: 'Orientar sobre pasteles y recopilar los datos de un pedido. El equipo confirma cotización, alergias, disponibilidad y pagos.', starters: [
      { title: 'Un pastel de cumpleaños', text: '¡Hola! Vi su anuncio en Instagram. Necesito un pastel para 25 personas el próximo sábado. ¿Qué opciones tienen?', source: 'Instagram · Pasteles personalizados' },
      { title: 'Precio y decoración', text: 'Vengo del anuncio de Facebook. ¿Cuánto cuesta un pastel para 16 personas? Me gustaría con decoración de dinosaurios.', source: 'Facebook · Celebra a tu manera' },
      { title: 'Una pregunta difícil', text: 'Mi hija tiene alergia a las nueces. ¿Pueden garantizar que el pastel es seguro para ella?', source: 'Consulta directa' },
    ] }],
  },
  {
    id: 'bestsign', name: 'BestSign', category: 'Firma electrónica', description: 'Preguntas sobre planes, firmas e integraciones.', fictional: true, agentName: 'Alex', knowledge: knowledge('bestsign'), sources: [],
    scenarios: [{ id: 'bestsign', label: 'Planes y funcionamiento', language: 'Español', goal: 'Explicar el servicio y orientar sobre planes según documentos, emisores y uso. Derivar consultas legales específicas y operaciones de cuentas.', starters: [
      { title: 'Elegir un plan', text: 'Hola, vi su anuncio. Somos cinco personas y enviamos unos 80 contratos al mes. ¿Qué plan necesitamos?', source: 'Instagram · Firma desde cualquier lugar' },
      { title: 'Cómo firman mis clientes', text: 'Vi BestSign en Facebook. Quiero que mis clientes firmen desde el teléfono. ¿Necesitan instalar algo o pagar?', source: 'Facebook · Menos papeles' },
      { title: 'Comprobar los límites', text: '¿La firma de BestSign sirve para cualquier trámite oficial en Brasil y sustituye un certificado digital?', source: 'Consulta directa' },
    ] }],
  },
  {
    id: 'saira', name: 'Saira', category: 'Alquileres temporales', description: 'Consultas de huéspedes y propietarios en Brasil.', fictional: false, agentName: 'Bia', knowledge: knowledge('saira'),
    sources: [
      { label: 'Servicios para propietarios', url: 'https://www.sairatemporada.com.br/anuncie-seu-imovel/' },
      { label: 'Casa Rosa', url: 'https://www.sairatemporada.com.br/imoveis/casa-rosa/' },
      { label: 'Apt Caravelas', url: 'https://www.sairatemporada.com.br/imoveis/saira-apt-caravelas/' },
      { label: 'Catálogo y precios de portada', url: 'https://www.sairatemporada.com.br/' },
    ],
    scenarios: [
      { id: 'saira-guests', label: 'Huéspedes', language: 'Português do Brasil', goal: 'Orientar a hóspedes sobre imóveis e coletar destino, datas e composição do grupo. Nunca confirmar reserva, disponibilidade ou preço final.', starters: [
        { title: 'Vacaciones en familia', text: 'Oi! Vi o anúncio no Instagram. Estamos procurando uma casa em Guaecá para 12 pessoas. Temos duas crianças e um cachorro.', source: 'Instagram · Férias em Guaecá' },
        { title: 'Consultar un precio', text: 'Olá! Vi a Casa Rosa no Facebook. Quanto custa a diária? No site encontrei dois valores diferentes.', source: 'Facebook · Casa Rosa' },
        { title: 'Pedir disponibilidad', text: 'O Apt Caravelas está livre para o próximo fim de semana? Somos seis pessoas e queremos reservar.', source: 'Consulta directa' },
      ] },
      { id: 'saira-owners', label: 'Propietarios', language: 'Português do Brasil', goal: 'Explicar gestão completa e divulgação. Coletar dados do imóvel para avaliação humana, sem prometer receita ou elegibilidade.', starters: [
        { title: 'Delegar la gestión', text: 'Oi! Vi o anúncio de vocês. Tenho uma casa em São Sebastião e queria que alguém cuidasse dos hóspedes e da limpeza. Como funciona?', source: 'Instagram · Gestão do seu imóvel' },
        { title: 'Comparar modalidades', text: 'Vi a Saíra no Facebook. Qual a diferença entre gestão completa e divulgação? Quanto vocês cobram?', source: 'Facebook · Anuncie seu imóvel' },
        { title: 'Expectativas de ingresos', text: 'Minha casa tem quatro quartos. Quanto vocês garantem que vou ganhar por mês?', source: 'Consulta directa' },
      ] },
    ],
  },
];

export function getScenario(id: ScenarioId) {
  const business = cases.find(c => c.scenarios.some(s => s.id === id));
  const scenario = business?.scenarios.find(s => s.id === id);
  if (!business || !scenario) throw new Error('Caso de uso desconocido.');
  return { business, scenario };
}
