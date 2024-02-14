import { ContentConfig, getContentConfig } from "../src/contentConfig";

describe("getContentConfig", () => {
  let contentConfig: ContentConfig;

  beforeEach(() => {
    contentConfig = {
      default: {
        chunkSize: 500,
        chunkOverlap: 0,
        selectors: ["body"],
        selectorsAll: [],
      },
      "domain.com": {
        chunkSize: 501,
        chunkOverlap: 1,
        selectors: ["body"],
        selectorsAll: [],
      },
      "domain.com/path1": {
        chunkSize: 502,
        chunkOverlap: 2,
        selectors: ["body"],
        selectorsAll: [],
      },
      "domain.com/path1/subpath1": {
        chunkSize: 503,
        chunkOverlap: 3,
        selectors: ["body"],
        selectorsAll: [],
      },
      "domain.com/path1/subpath2": {
        chunkSize: 504,
        chunkOverlap: 4,
        selectors: ["body"],
        selectorsAll: [],
      },
    };
  });

  test("should return null", () => {
    const url = new URL("https://notdomain.com");
    const config = getContentConfig(url, contentConfig);
    expect(config).toBeNull();
  });

  test("should match shortest path", () => {
    const url = new URL("https://domain.com");
    const config = getContentConfig(url, contentConfig);
    expect(config?.chunkSize).toEqual(501);
  });

  test("should match middle path", () => {
    const url = new URL("https://domain.com/path1/subpath3");
    const config = getContentConfig(url, contentConfig);
    expect(config?.chunkSize).toEqual(502);
  });

  test("should match longest path", () => {
    const url = new URL("https://domain.com/path1/subpath1");
    const config = getContentConfig(url, contentConfig);
    expect(config?.chunkSize).toEqual(503);
  });
});
