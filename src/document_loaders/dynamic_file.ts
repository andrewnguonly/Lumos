import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "langchain/document_loaders/base";

export interface LoadersMapping {
  [extension: string]: (file: File) => BaseDocumentLoader;
}

export class DynamicFileLoader extends BaseDocumentLoader {
  constructor(
    public file: File,
    public loaders: LoadersMapping,
  ) {
    super();

    if (Object.keys(loaders).length === 0) {
      throw new Error("Must provide at least one loader");
    }
    for (const extension in loaders) {
      if (Object.hasOwn(loaders, extension)) {
        if (extension[0] !== ".") {
          throw new Error(`Extension must start with a dot: ${extension}`);
        }
      }
    }
  }

  public async load(): Promise<Document[]> {
    const documents: Document[] = [];
    const extension =
      "." + this.file.name.split(".").pop()?.toLowerCase() || "";

    if (extension !== "" && extension in this.loaders) {
      const loaderFactory = this.loaders[extension];
      const loader = loaderFactory(this.file);
      documents.push(...(await loader.load()));
    } else {
      // default to using text loader
      throw new Error("No extension found in file name");
    }

    return documents;
  }
}
