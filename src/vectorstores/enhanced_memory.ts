import {
  CallbackManagerForRetrieverRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";
import { Document, DocumentInterface } from "@langchain/core/documents";
import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import Fuse from "fuse.js";

export type EnhancedMemoryRetrieverInput<V extends EnhancedMemoryVectorStore> =
  BaseRetrieverInput &
    (
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType?: "similarity";
        }
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType: "keyword";
        }
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType: "hybrid";
        }
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType: "mmr"; // this search is not implemented, but is required for type compatibility
        }
    );

export class EnhancedMemoryRetriever<
  V extends EnhancedMemoryVectorStore,
> extends BaseRetriever {
  vectorStore: V;

  k = 4;

  searchType = "similarity";

  filter?: V["FilterType"];

  static lc_name() {
    return "EnhancedMemoryRetriever";
  }

  get lc_namespace() {
    return ["lumos", "vectorstores"];
  }

  constructor(fields: EnhancedMemoryRetrieverInput<V>) {
    super(fields);
    this.vectorStore = fields.vectorStore;
    this.k = fields.k ?? this.k;
    this.searchType = fields.searchType ?? this.searchType;
    this.filter = fields.filter;
  }

  _vectorstoreType(): string {
    return this.vectorStore._vectorstoreType();
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun,
  ): Promise<DocumentInterface[]> {
    if (this.searchType === "similarity") {
      return this.vectorStore.similaritySearch(
        query,
        this.k,
        this.filter,
        runManager?.getChild("vectorstore"),
      );
    } else if (this.searchType === "keyword") {
      return this.vectorStore.keywordSearch(query, this.k, this.filter);
    } else {
      // hybrid search
      return this.vectorStore.hybridSearch(
        query,
        this.k,
        this.filter,
        runManager?.getChild("vectorstore"),
      );
    }
  }

  async addDocuments(documents: DocumentInterface[]): Promise<string[] | void> {
    return await this.vectorStore.addDocuments(documents);
  }
}

export class EnhancedMemoryVectorStore extends MemoryVectorStore {
  _vectorstoreType(): string {
    return "enhanced-memory";
  }

  async keywordSearch(
    query: string,
    k: number,
    filter?: this["FilterType"],
  ): Promise<DocumentInterface[]> {
    const results = await this.keywordSearchWithScore(query, k, filter);
    return results.map((result) => result[0]);
  }

  async keywordSearchWithScore(
    query: string,
    k: number,
    filter?: this["FilterType"],
  ): Promise<[DocumentInterface, number][]> {
    // filter documents (MemoryVector interface is not exported...)
    const filterFunction = (memoryVector: (typeof this.memoryVectors)[0]) => {
      if (!filter) {
        return true;
      }

      const doc = new Document({
        metadata: memoryVector.metadata,
        pageContent: memoryVector.content,
      });
      return filter(doc);
    };
    const filteredDocRecords = this.memoryVectors
      .filter(filterFunction)
      .map((memoryVector) => {
        return {
          metadata: memoryVector.metadata,
          pageContent: memoryVector.content,
        };
      });

    // keyword (fuzzy) search
    // fuse options: https://www.fusejs.io/api/options.html#options
    const fuseOptions = {
      includeScore: true,
      ignoreLocation: true,
      keys: ["pageContent"],
    };
    const fuse = new Fuse(filteredDocRecords, fuseOptions);
    const result = fuse.search(query, { limit: k });

    // return documents and scores
    return Promise.all(result).then((fuseResult) => {
      return fuseResult.map((fuseResult) => {
        return [new Document(fuseResult.item), fuseResult.score as number];
      });
    });
  }

  async hybridSearch(
    query: string,
    k: number,
    filter?: this["FilterType"],
    _callbacks?: Callbacks,
  ): Promise<DocumentInterface[]> {
    const similarity_search = await this.similaritySearchWithScore(
      query,
      k,
      filter,
      _callbacks,
    ).then((docTuples) => {
      return docTuples.map((docTuple) => {
        // normalize cosine similarity score between 0 and 1
        const score = docTuple[1];
        const normalizedScore = (score + 1) / 2;
        docTuple[1] = normalizedScore;
        return docTuple;
      });
    });
    console.log("Similarity search results: ", similarity_search);

    const keyword_search = await this.keywordSearchWithScore(
      query,
      k,
      filter,
    ).then((docTuples) => {
      return docTuples.map((docTuple) => {
        // manually downscale Fuzziness score to better blend with cosine similarity score
        const score = docTuple[1];
        const normalizedScore = score * 0.7;
        docTuple[1] = normalizedScore;
        return docTuple;
      });
    });
    console.log("Keyword search results: ", keyword_search);

    return (
      Promise.all([similarity_search, keyword_search])
        .then((docTuples) => docTuples.flat())
        .then((docTuples) => {
          const picks = new Map<number, [Document, number]>();

          docTuples.forEach((docTuple: [Document, number]) => {
            const id = docTuple[0].metadata.docId;
            const nextScore = docTuple[1];
            const prevScore = picks.get(id)?.[1];

            if (prevScore === undefined || nextScore > prevScore) {
              picks.set(id, docTuple);
            }
          });

          return Array.from(picks.values());
        })
        // sort by score
        .then((docTuples) => docTuples.sort((a, b) => b[1] - a[1]))
        // select top k
        .then((docTuples) => docTuples.slice(0, k))
        // get documents
        .then((docTuples) => docTuples.map((docTuple) => docTuple[0]))
    );
  }

  asRetriever(
    kOrFields?: number | Partial<EnhancedMemoryRetrieverInput<this>>,
    filter?: this["FilterType"],
    callbacks?: Callbacks,
    tags?: string[],
    metadata?: Record<string, unknown>,
    verbose?: boolean,
  ): EnhancedMemoryRetriever<this> {
    if (typeof kOrFields === "number") {
      return new EnhancedMemoryRetriever({
        vectorStore: this,
        k: kOrFields,
        filter,
        tags: [...(tags ?? []), this._vectorstoreType()],
        metadata,
        verbose,
        callbacks,
      });
    } else {
      const params = {
        vectorStore: this,
        k: kOrFields?.k,
        filter: kOrFields?.filter,
        tags: [...(kOrFields?.tags ?? []), this._vectorstoreType()],
        metadata: kOrFields?.metadata,
        verbose: kOrFields?.verbose,
        callbacks: kOrFields?.callbacks,
        searchType: kOrFields?.searchType,
      };
      return new EnhancedMemoryRetriever({ ...params });
    }
  }
}
