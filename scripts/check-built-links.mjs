import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import assert from "node:assert/strict";

const root = resolve("dist");
const files = [];
function walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path);
		else if (path.endsWith(".html")) files.push(path);
	}
}
walk(root);
let checked = 0;
for (const file of files) {
	const html = readFileSync(file, "utf8");
	const page = new URL(
		relative(root, file)
			.replaceAll("\\", "/")
			.replace(/index\.html$/, ""),
		"https://bruno-is.github.io/DevDocs/",
	);
	// Examine links reais; exemplos Shiki contêm texto escapado como href="/a".
	for (const [, raw] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
		const url = new URL(raw.replaceAll("&amp;", "&"), page);
		if (url.origin !== page.origin) continue;
		assert(
			url.pathname.startsWith("/DevDocs/"),
			`${relative(root, file)}: link sem base: ${raw}`,
		);
		let target = join(
			root,
			decodeURIComponent(url.pathname.slice("/DevDocs/".length)),
		);
		if (url.pathname.endsWith("/")) target = join(target, "index.html");
		assert(
			existsSync(target),
			`${relative(root, file)}: destino ausente: ${raw}`,
		);
		if (url.hash && target.endsWith(".html")) {
			const id = decodeURIComponent(url.hash.slice(1));
			const targetHtml = readFileSync(target, "utf8");
			assert(
				targetHtml.includes(`id="${id}"`),
				`${relative(root, file)}: âncora ausente: ${raw}`,
			);
		}
		checked++;
	}
}
console.log(
	`${files.length} páginas; ${checked} links internos/âncoras válidos.`,
);
