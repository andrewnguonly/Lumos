function htmlToString(selector) {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return "";
    } else {
        selector = document.documentElement;
    }

    // strip HTML tags
    var parser = new DOMParser();
    var doc = parser.parseFromString(selector.outerHTML, "text/html");
    var textContent = doc.body.innerText || "";

    // Use a regular expression to replace contiguous white spaces with a single space
    textContent = textContent.replace(/\s+/g, " ");

    return textContent.trim();
}
