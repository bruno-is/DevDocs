// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";

// Compartilhado entre a instância principal (vite.plugins) e a do worker
// (vite.worker.plugins) — só o worker realmente importa @php-wasm/web-8-4,
// mas o flag precisa ser único para o aviso em buildEnd não disparar falso-positivo.
let phpWasmPatchApplied = false;

/**
 * Faz o binário .wasm do php-wasm ser importado como URL (asset estático),
 * em vez do Vite tentar tratá-lo como módulo — necessário para funcionar sob
 * o base path do GitHub Pages sem backend. O patch depende de um detalhe de
 * implementação do código gerado por @php-wasm/web-8-4 (nome da variável
 * `dependencyFilename`); se uma atualização da dependência mudar esse
 * codegen, o regex para de bater e isso quebraria a sandbox em silêncio —
 * por isso o aviso em `buildEnd` caso o patch nunca tenha sido aplicado.
 */
/**
 * @param {{ warnIfUnmatched?: boolean }} [options] Só a instância registrada
 * em `vite.worker.plugins` deve avisar: é o bundle do worker que de fato
 * importa `@php-wasm/web-8-4`, então só o `buildEnd` dele reflete se o patch
 * foi aplicado num build de verdade (evita falso-positivo em `astro check`,
 * que não empacota o worker).
 */
function phpWasmUrlImports({ warnIfUnmatched = false } = {}) {
	return {
		name: "devdocs-php-wasm-url-imports",
		enforce: "pre",
		/**
		 * @param {string} code
		 * @param {string} id
		 */
		transform(code, id) {
			const normalizedId = id.replace(/\\/g, "/").split("?")[0];
			if (
				!normalizedId.includes("/node_modules/@php-wasm/web-8-4/") ||
				!normalizedId.endsWith("/php_8_4.js")
			) {
				return null;
			}

			const transformed = code.replace(
				/(import\s+dependencyFilename\s+from\s+["'][^"']*php_8_4\.wasm)([^"']*)(["'])/g,
				(_match, importPath, query, quote) => {
					phpWasmPatchApplied = true;
					if (query.includes("url")) return `${importPath}${query}${quote}`;
					const separator = query ? "&" : "?";
					return `${importPath}${query}${separator}url${quote}`;
				},
			);

			return transformed === code ? null : transformed;
		},
		/**
		 * @param {Error | null} error
		 */
		buildEnd(error) {
			if (!warnIfUnmatched || error || phpWasmPatchApplied) return;
			console.warn(
				"[devdocs-php-wasm-url-imports] o patch do import de php_8_4.wasm não encontrou o padrão esperado dentro de @php-wasm/web-8-4 — a sandbox de PHP pode ter quebrado silenciosamente após um update da dependência. Revise a regex em astro.config.mjs.",
			);
		},
	};
}

// GitHub Pages project site: https://bruno-is.github.io/DevDocs/
// `site` + `base` must stay in sync with the repository name.
export default defineConfig({
	site: "https://bruno-is.github.io",
	base: "/DevDocs",
	trailingSlash: "always",
	build: {
		format: "directory",
	},
	integrations: [vue(), icon()],
	vite: {
		plugins: [phpWasmUrlImports(), tailwindcss()],
		assetsInclude: ["**/*.wasm", "**/*.so"],
		optimizeDeps: {
			exclude: ["@php-wasm/web-8-4"],
		},
		worker: {
			format: "es",
			plugins: () => [phpWasmUrlImports({ warnIfUnmatched: true })],
		},
	},
	markdown: {
		// Shiki powers code highlighting via the <Code /> component too.
		shikiConfig: {
			theme: "github-dark-default",
			wrap: false,
		},
	},
});
