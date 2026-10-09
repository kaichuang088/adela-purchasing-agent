import {getMedia} from '@/lib/media-store';

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  if (key.join("/") === "catalog-demo") return Response.redirect(new URL("/kk-hero.png",_request.url),302);
  if (key[0] === "quote-drafts") return new Response("Not found", {status:404});
  const object = await getMedia(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({'Content-Type':object.contentType,'Cache-Control':'public, max-age=86400'});
  headers.set("etag", object.etag);
  return new Response(object.bytes, { headers });
}
