import { dsvFormat } from "d3-dsv";
import { CSVLoader } from "langchain/document_loaders/fs/csv";

export class CSVPackedLoader extends CSVLoader {
  /**
   * This function is copied from the CSVLoader class with a few
   * modifications so that it's able to run in a Chrome extension
   * context.
   */
  public async parse(raw: string): Promise<string[]> {
    const { column, separator = "," } = this.options;

    const psv = dsvFormat(separator);
    // cannot use psv.parse(), unsafe-eval is not allowed
    let parsed = psv.parseRows(raw.trim());

    if (column !== undefined) {
      if (!parsed[0].includes(column)) {
        throw new Error(`Column ${column} not found in CSV file.`);
      }
      // get index of column
      const columnIndex = parsed[0].indexOf(column);
      // Note TextLoader will raise an exception if the value is null.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return parsed.map((row) => row[columnIndex]!);
    }

    // parsed = [["foo", "bar"], ["1", "2"], ["3", "4"]]
    // output strings = ["foo: 1\nbar: 2", "foo: 3\nbar: 4"]

    // get first element of parsed
    const headers = parsed[0];
    parsed = parsed.slice(1);

    return parsed.map((row) =>
      row.map((key, index) => `${headers[index]}: ${key}`).join("\n"),
    );
  }
}
