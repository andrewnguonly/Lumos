import { Document } from "@langchain/core/documents";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { WebPDFLoader } from "langchain/document_loaders/web/pdf";

import { Attachment } from "../components/ChatBar";
import { CSVPackedLoader } from "../document_loaders/csv";
import { DynamicFileLoader } from "../document_loaders/dynamic_file";

export const getExtension = (fileName: string, withDot = false): string => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return withDot ? `.${extension}` : extension;
};

export const getBase64Str = async (file: File): Promise<string> => {
  const loader = new DynamicFileLoader(file, {
    // add more loaders that require DOM/browser APIs here
    ".pdf": (file) => new WebPDFLoader(file, { splitPages: false }),
  });
  const docs = await loader.load();

  // construct new base64 encoded string
  let pageContent = "";
  for (const doc of docs) {
    pageContent += doc.pageContent + "\n\n";
  }
  const utf8Bytes = new TextEncoder().encode(pageContent);
  let binary = "";
  utf8Bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return `data:${file.type};base64,${btoa(binary)}`;
};

export const getDocuments = async (
  attachment: Attachment,
): Promise<Document[]> => {
  const base64 = attachment.base64;
  const byteString = atob(base64.split(",")[1]);
  const mimeString = base64.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });
  const file = new File([blob], attachment.name, { type: mimeString });

  const loader = new DynamicFileLoader(file, {
    // add more loaders that don't require DOM/browser APIs here
    ".csv": (file) => new CSVPackedLoader(file),
    ".json": (file) => new JSONLoader(file),
  });

  return await loader.load();
};
