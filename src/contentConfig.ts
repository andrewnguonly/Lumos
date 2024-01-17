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
  "reddit.com": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [],
    selectorsAll: [
      "shreddit-comment",
    ],
  },
  "stackoverflow.com": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "#question-header",
      "#mainbar",
    ],
    selectorsAll: [],
  },
  "substack.com": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "article",
    ],
    selectorsAll: [],
  },
  "wikipedia.org": {
    chunkSize: 2000,
    chunkOverlap: 500,
    selectors: [
      "#bodyContent",
    ],
    selectorsAll: [],
  },
  "yelp.com": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "#location-and-hours",
      "#reviews",
    ],
    selectorsAll: [],
  },
}
