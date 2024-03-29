import { CSVPackedLoader } from "../../src/document_loaders/csv";

describe("Calculator", () => {
  let loader: CSVPackedLoader;

  beforeEach(() => {
    loader = new CSVPackedLoader("path/to/file.csv");
  });

  describe("parse", () => {
    test("should parse rows", async () => {
      const raw = "foo,bar\n1,2\n3,4";
      const expected = ["foo: 1\nbar: 2", "foo: 3\nbar: 4"];
      expect(await loader.parse(raw)).toStrictEqual(expected);
    });
  });
});
