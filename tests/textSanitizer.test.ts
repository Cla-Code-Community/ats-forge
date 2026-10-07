import { describe, expect, it } from 'vitest';
import { humanizeName, sanitizeText } from '../src/domain/services/TextSanitizer';

describe('sanitizeText', () => {
  it('remove emoji e preserva o texto', () => {
    expect(sanitizeText('Olá 👋 mundo 🚀')).toBe('Olá mundo');
  });

  it('decodifica entidades HTML comuns', () => {
    expect(sanitizeText('a &amp; b &nbsp; c')).toBe('a & b c');
  });

  it('preserva acentos do português', () => {
    expect(sanitizeText('Integração e observabilidade em tempo real')).toBe(
      'Integração e observabilidade em tempo real',
    );
  });

  it('normaliza aspas e travessões', () => {
    expect(sanitizeText('“aspas” — travessão')).toBe('"aspas" - travessão');
  });

  it('remove sequências ZWJ de emoji (ex.: 🧑‍💻)', () => {
    const out = sanitizeText('Dev 🧑‍💻 pleno');
    expect(out).toBe('Dev pleno');
  });
});

describe('humanizeName', () => {
  it('humaniza snake_case e kebab-case', () => {
    expect(humanizeName('node-monitoring')).toBe('Node Monitoring');
    expect(humanizeName('CARDS_ICON_VANILLAJS')).toBe('Cards Icon Vanillajs');
  });
});
