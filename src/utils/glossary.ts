import fs from 'fs';
import path from 'path';

export interface IGlossaryEntry {
  term: string;
  translations: Record<string, string>;
  context?: string;
  notes?: string;
}

export class Glossary {
  private entries: IGlossaryEntry[] = [];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Load glossary from file
   */
  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = await fs.promises.readFile(this.filePath, 'utf8');
        this.entries = JSON.parse(data);
      } else {
        console.warn(`Glossary file not found at ${this.filePath}. Creating a new glossary.`);
        this.entries = [];
        await this.save(); // Create empty file
      }
    } catch (error) {
      console.error(`Error loading glossary: ${error}`);
      throw error;
    }
  }

  /**
   * Save glossary to file
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving glossary: ${error}`);
      throw error;
    }
  }

  /**
   * Add or update a glossary entry
   */
  addEntry(entry: IGlossaryEntry): void {
    const existingIndex = this.entries.findIndex((e) => e.term.toLowerCase() === entry.term.toLowerCase());
    if (existingIndex >= 0) {
      this.entries[existingIndex] = {
        ...this.entries[existingIndex],
        ...entry,
        translations: {
          ...this.entries[existingIndex].translations,
          ...entry.translations,
        },
      };
    } else {
      this.entries.push(entry);
    }
  }

  /**
   * Remove a glossary entry
   */
  removeEntry(term: string): boolean {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
    return this.entries.length !== initialLength;
  }

  /**
   * Get all glossary entries
   */
  getAllEntries(): IGlossaryEntry[] {
    return [...this.entries];
  }

  /**
   * Get glossary entries for a specific language
   */
  getEntriesForLanguage(language: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    this.entries.forEach((entry) => {
      if (entry.translations[language]) {
        result[entry.term] = entry.translations[language];
      }
    });
    
    return result;
  }

  /**
   * Search for entries matching a term
   */
  searchEntries(searchTerm: string): IGlossaryEntry[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return this.entries.filter((entry) => 
      entry.term.toLowerCase().includes(lowerSearchTerm) ||
      Object.values(entry.translations).some((translation) => 
        translation.toLowerCase().includes(lowerSearchTerm)
      )
    );
  }
}

export default Glossary; 