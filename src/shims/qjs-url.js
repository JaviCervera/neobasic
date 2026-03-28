export function fileURLToPath(url) {
  const str = typeof url === "string" ? url : url.href;
  // Windows: file:///C:/... or file://C:/...
  return str
    .replace(/^file:\/\/\/([a-zA-Z]:)/, "$1")
    .replace(/^file:\/\/([a-zA-Z]:)/, "$1")
    .replace(/^file:\/\/\//, "/")
    .replace(/^file:\/\//, "");
}
