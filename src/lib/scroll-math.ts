/**
 * Calcula a velocidade ideal de rolagem para uma música
 * baseado no tamanho do conteúdo, BPM e altura da viewport.
 *
 * Retorna um inteiro entre 50 e 500 (escala do banco de dados).
 * Ex: 100 = 1.0x, 250 = 2.5x
 */
export function calculateOptimalScrollSpeed(
  songContent: string | null | undefined,
  songBpm: number | null | undefined
): number {
  const viewportHeight = (typeof window !== "undefined" && window.innerHeight) || 800;
  const lineCount = songContent ? songContent.split("\n").length : 50;
  const bpm = songBpm && songBpm > 0 ? songBpm : 100;

  const LINE_HEIGHT_PX = 24;
  const screensToScroll = (lineCount * LINE_HEIGHT_PX) / viewportHeight;
  const bpmFactor = bpm / 100;
  const multiplier = screensToScroll * bpmFactor * 0.5;

  // Converte multiplicador (ex: 2.5) para escala inteira do DB (ex: 250)
  const speed = Math.round(multiplier * 100);
  return Math.max(50, Math.min(500, speed));
}
