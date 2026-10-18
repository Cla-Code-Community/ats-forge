import fs from 'fs';
import { IKeywordExtractor } from '../../domain/interfaces/IKeywordExtractor';
import { extractKeywordsFromText } from '../../domain/services/KeywordExtractor';

export class FileKeywordExtractor implements IKeywordExtractor {
  extract(filePath: string | null): string[] {
    if (!filePath) return [];

    if (!fs.existsSync(filePath)) {
      console.warn(`[aviso] Arquivo de descrição da vaga não encontrado: ${filePath}`);
      return [];
    }

    return extractKeywordsFromText(fs.readFileSync(filePath, 'utf-8'));
  }
}
