const RELEVANT_HEADING =
  /(responsabilidad|atribuiç|requisit|qualificaç|diferenci|desej[áa]ve|nice[- ]?to[- ]?have|requirements?|responsibilit|atividades|o que (voc[êe]|esperamos|buscamos|faz)|hard skills|must[- ]?have|habilidades|conhecimentos?|perfil (desejado|t[ée]cnico|da vaga)|sobre a vaga|stacks?)/i;

const NOISE_HEADING =
  /(benef[íi]ci|informaç[õo]es adicionais|sobre (a |o |n[óo]s|a empresa|n[óo]s)|quem somos|nosso jeito|nossos valores|valores|cultura|diversidad|o que oferecemos|oferecemos|trabalhe (na|no|conosco|com)|venha ser|remuneraç|sal[áa]ri|hor[áa]rio|jornada|modelo de contrataç|contrataç|vale[- ]|plano de sa[úu]de|gympass|wellhub)/i;

const MIN_FOCUSED_LEN = 40;
const MAX_HEADING_LEN = 70;

export function focusJobDescription(description: string | null | undefined): string {
  if (!description || !description.trim()) return '';

  const lines = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const kept: string[] = [];
  let mode: 'keep' | 'drop' = 'drop';
  let sawRelevant = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (mode === 'keep' && kept.length > 0 && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }

    if (isHeadingLike(trimmed)) {
      if (RELEVANT_HEADING.test(trimmed)) {
        mode = 'keep';
        sawRelevant = true;
        kept.push(trimmed);
        continue;
      }
      if (NOISE_HEADING.test(trimmed)) {
        mode = 'drop';
        continue;
      }
    }

    if (mode === 'keep') kept.push(trimmed);
  }

  const focused = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!sawRelevant || focused.length < MIN_FOCUSED_LEN) return description.trim();
  return focused;
}

function isHeadingLike(line: string): boolean {
  if (line.length > MAX_HEADING_LEN) return false;
  if (/[.!?;]$/.test(line)) return false;
  return true;
}
