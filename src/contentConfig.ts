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

export const defaultContentConfig: ContentConfig = {
  default: {
    chunkSize: DEFAULT_CHUCK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    selectors: ["body"],
    selectorsAll: [],
  },
};

export const isContentConfig = (input: string): boolean => {
  try {
    const parsedConfig: ContentConfig = JSON.parse(input);
    for (const key in parsedConfig) {
      if (
        typeof parsedConfig[key].chunkSize !== "number" ||
        typeof parsedConfig[key].chunkOverlap !== "number" ||
        !Array.isArray(parsedConfig[key].selectors) ||
        !Array.isArray(parsedConfig[key].selectorsAll) ||
        !parsedConfig[key].selectors.every(
          (selector) => typeof selector === "string",
        ) ||
        !parsedConfig[key].selectorsAll.every(
          (selector) => typeof selector === "string",
        )
      ) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Return the content config that matches the current URL path.
 *
 * Each URL path can have a custom content config. For example,
 * domain.com/path1 and domain.com/path2 can have different content
 * configs. Additionally, content config paths can be nested. For
 * example, domain.com/path1/subpath1 and domain.com/path1. In
 * this case, the function will try to match the longest path first.
 *
 * Subdomains are also matched. If no matching path is found, null is
 * returned.
 */
export const getContentConfig = (
  url: URL,
  contentConfig: ContentConfig,
): null | {
  chunkSize: number;
  chunkOverlap: number;
  selectors: string[];
  selectorsAll: string[];
} => {
  const domainParts = url.hostname.split(".");
  const topLevelDomain = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`;
  const searchPath = `${topLevelDomain}${url.pathname}`;

  // Order keys (paths) of contentConfig in reverse order and check if any
  // key is a substring of searchPath. This will find the longest matching
  // key (path).
  const paths = Object.keys(contentConfig).sort().reverse();
  const matchingPath = paths.find((path) => searchPath.startsWith(path));

  return matchingPath ? contentConfig[matchingPath] : null;
};
