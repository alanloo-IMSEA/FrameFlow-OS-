export function acceptedImageItemKeys(fields:unknown):string[]{
 const values=Array.isArray(fields)?fields:[];
 const keys=values.map(String).map(field=>field.match(/^production_items\.([^.]+)\.asset\.(\d+)$/)).filter((match):match is RegExpMatchArray=>Boolean(match)).map(match=>`${match[1]}-asset-${match[2]}`);
 return Array.from(new Set(keys));
}
