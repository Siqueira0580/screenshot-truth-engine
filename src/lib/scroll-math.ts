/**
 * Calcula o multiplicador de velocidade ideal de rolagem para uma música
 * baseado no tamanho do conteúdo, BPM e altura da viewport.
 *
 * Retorna um valor entre 0.5x e 5.0x, arredondado a 1 casa decimal.
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
  const speed = screensToScroll * bpmFactor * 0.5;

  return Math.max(0.5, Math.min(5.0, Number(speed.toFixed(1))));
}
