const getHighlightedContent = (): string => {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
};

/**
 * Get content from current tab.
 * 
 * @param {string[]} selectors - selector queries to get content, i.e. document.querySelector().
 * @param {string[]} selectorsAll - selectorAll queries to get content, i.e. document.querySelectorAll().
 * @returns {[string, boolean]} - Tuple of content and boolean indicating if content was highlighted content.
 */
export const getHtmlContent = (selectors: string[], selectorsAll: string[]): [string, boolean] => {

  // if any content is highlighted, return the highlighted content
  const highlightedContent = getHighlightedContent();
  if (highlightedContent !== "") {
    return [highlightedContent, true];
  } 

  // otherwise, return content from selected elements
  const parser = new DOMParser();
  var content = "";
  const elements: Element[] = [];

  // process selector queries
  if (selectors.length > 0) {
    for (const selector of selectors) {
      const selectedElement = document.querySelector(selector);
      if (selectedElement !== null) {
        elements.push(selectedElement);
      }
    }
  }

  // process selectorAll queries
  if (selectorsAll.length > 0) {
    for (const selectorAll of selectorsAll) {
      const selectedElements = document.querySelectorAll(selectorAll);
      for (let i = 0; i < selectedElements.length; i++) {
        elements.push(selectedElements[i]);
      }
    }
  }

  // retrieve content from selected elements
  for (const element of elements) {
    const doc = parser.parseFromString(element.outerHTML, "text/html");
    var textContent = doc.body.innerText || "";

    // Use a regular expression to replace contiguous white spaces with a single space
    textContent = textContent.replace(/\s+/g, " ").trim();

    // append textContent to overall content
    content += textContent + "\n";
  }

  return [content, false];
};
