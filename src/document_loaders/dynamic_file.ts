import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "langchain/document_loaders/base";
import { TextLoader } from "langchain/document_loaders/fs/text";

import { getExtension } from "./util";

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
    const extension = getExtension(this.file);
    let loader;

    if (extension !== "" && extension in this.loaders) {
      const loaderFactory = this.loaders[extension];
      loader = loaderFactory(this.file);
    } else {
      // default to using text loader
      loader = new TextLoader(this.file);
    }

    documents.push(...(await loader.load()));
    return documents;
  }
}
