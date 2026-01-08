export const CANON_SPEC_V1 = "asx://canon/json.bytes.v1";

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        sorted[key] = sortObject(value[key]);
      });
    return sorted;
  }
  return value;
}

export function canonJsonBytesV1(obj) {
  const sorted = sortObject(obj);
  const json = JSON.stringify(sorted);
  return new TextEncoder().encode(json);
}
