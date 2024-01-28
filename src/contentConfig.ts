const DEFAULT_CHUCK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 0;

export interface ContentConfig {
  [key: string]: {
    chunkSize: number;
    chunkOverlap: number;
    selectors: string[];
    selectorsAll: string[];
  };
}

export const isContentConfig = (input: string): boolean => {
  try {
    const parsedConfig: ContentConfig = JSON.parse(input);
    for (const key in parsedConfig) {
      if (
        typeof parsedConfig[key].chunkSize !== 'number' ||
        typeof parsedConfig[key].chunkOverlap !== 'number' ||
        !Array.isArray(parsedConfig[key].selectors) ||
        !Array.isArray(parsedConfig[key].selectorsAll) ||
        !parsedConfig[key].selectors.every((selector) => typeof selector === 'string') ||
        !parsedConfig[key].selectorsAll.every((selector) => typeof selector === 'string')
      ) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

export const defaultContentConfig: ContentConfig = {
  "default": {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: [
      "body",
    ],
    selectorsAll: [],
  },
};

// TODO: Delete this later...
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
