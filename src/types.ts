export type LandDocumentType = 'Thông tư' | 'Nghị định' | 'Luật' | 'Khác';

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

export interface LandDocument {
  id: string;
  title: string;
  type: LandDocumentType;
  abbreviation: string;
  issueDate: string;
  summary: string;
  sections: DocumentSection[];
  rawContent?: string;
  createdAt?: string;
  isSimulated?: boolean;
}

export interface SearchResult {
  docId: string;
  docTitle: string;
  docAbbreviation: string;
  matchCount: number;
  matchedSections: {
    sectionId: string;
    sectionTitle: string;
    highlightedContent: string;
  }[];
}
