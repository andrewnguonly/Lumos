const DEFAULT_CHUCK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 0;

interface ContentConfig {
  [key: string]: {
    chunkSize: number;
    chunkOverlap: number;
    selectors: string[];
    selectorsAll: string[];
  };
}

export const contentConfig: ContentConfig = {
  "default": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "body",
    ],
    selectorsAll: [],
  },
  "medium.com": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "article",
    ],
    selectorsAll: [],
  },
}
