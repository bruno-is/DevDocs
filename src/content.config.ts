import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * Schema da coleção de documentações.
 *
 * Espelha fielmente o formato legado `window.DOC_DATA_REGISTRY[slug]`
 * (ver `assets/js/docs-core.js` e `data/*.data.js`), acrescido de dois campos
 * derivados na migração: `tech` (para agrupar na home) e `order` (ordenação).
 *
 * Fonte única do tipo TypeScript do conteúdo — nada de layout aqui.
 */

const calloutSchema = z.object({
	type: z.enum(["hint", "warn", "danger"]),
	label: z.string(),
	text: z.string(),
});
export type Callout = z.infer<typeof calloutSchema>;

// --- Content blocks (union discriminada por `type`) ---------------------------

const referenceCardBlock = z.object({
	type: z.literal("reference-card"),
	title: z.string().optional(),
	description: z.string().optional(),
	items: z.array(z.string()).optional(),
	/** Destinos da coleção; resolvidos com docUrl e validados durante o build. */
	links: z
		.array(
			z.object({
				label: z.string(),
				doc: z.string(),
				section: z.string().optional(),
			}),
		)
		.optional(),
});

const techListBlock = z.object({
	type: z.literal("tech-list"),
	title: z.string().optional(),
	termHeader: z.string().optional(),
	descriptionHeader: z.string().optional(),
	items: z.array(
		z.object({
			term: z.string(),
			description: z.string(),
		}),
	),
});

const checklistBlock = z.object({
	type: z.literal("checklist-block"),
	title: z.string().optional(),
	items: z.array(z.string()),
});

const comparisonBlock = z.object({
	type: z.literal("comparison-block"),
	title: z.string().optional(),
	columns: z.array(
		z.object({
			title: z.string().optional(),
			description: z.string().optional(),
			items: z.array(z.string()).optional(),
		}),
	),
});

const contextBlock = z.object({
	type: z.literal("context-block"),
	title: z.string().optional(),
	variant: z
		.enum(["good-practice", "common-error", "attention", "tip"])
		.optional(),
	label: z.string().optional(),
	text: z.string().optional(),
});

const flowStepsBlock = z.object({
	type: z.literal("flow-steps"),
	title: z.string().optional(),
	steps: z.array(z.string()),
});

/**
 * Explorador de arquitetura interativo (só docs de `tech: arquitetura`): funde
 * um diagrama de camadas, a árvore de pastas/arquivos e cards de
 * responsabilidade numa peça só. Cada camada tem um `id` que liga as três
 * vistas — clicar numa camada destaca a pasta e o card relacionados (ver
 * `scripts/arch-explorer.ts`). Puramente aditivo: nenhuma doc antiga usa.
 */
const architectureExplorerBlock = z.object({
	type: z.literal("architecture-explorer"),
	title: z.string().optional(),
	description: z.string().optional(),
	/** Estilo do diagrama: pilha de camadas (padrão) ou círculos concêntricos. */
	shape: z.enum(["stack", "concentric"]).default("stack"),
	/** Dica curta sobre a interação; default no componente se ausente. */
	hint: z.string().optional(),
	/** Camadas/peças — fonte da verdade que liga diagrama, árvore e cards. */
	layers: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				/** Uma linha: a responsabilidade da camada. */
				role: z.string(),
				/** Frase extra opcional no card. */
				detail: z.string().optional(),
				/** "Depende de / conhece". */
				knows: z.string().optional(),
				/** "Não conhece / não importa". */
				avoids: z.string().optional(),
			}),
		)
		.min(1),
	/** Árvore de projeto; cada nó pode referenciar uma `layers[].id`. */
	tree: z
		.array(
			z.object({
				label: z.string(),
				depth: z.number().default(0),
				kind: z.enum(["dir", "file"]).default("file"),
				/** Liga o nó a uma camada (mesmo `id` de `layers`). */
				layer: z.string().optional(),
				/** Comentário inline, exibido esmaecido. */
				note: z.string().optional(),
			}),
		)
		.optional(),
});

const contentBlockSchema = z.discriminatedUnion("type", [
	referenceCardBlock,
	techListBlock,
	checklistBlock,
	comparisonBlock,
	contextBlock,
	flowStepsBlock,
	architectureExplorerBlock,
	z.object({
		type: z.literal("sources"),
		title: z.string().optional(),
		items: z
			.array(
				z.object({
					label: z.string(),
					url: z
						.url()
						.refine(
							(url) => url.startsWith("https://"),
							"Referências devem usar HTTPS",
						),
				}),
			)
			.min(1),
	}),
	z.object({
		type: z.literal("exercise"),
		title: z.string().optional(),
		prompt: z.string(),
		answer: z.string(),
		rubric: z.array(z.string()).min(1),
	}),
	z.object({
		type: z.literal("diagram"),
		caption: z.string(),
		nodes: z.array(z.object({ label: z.string(), detail: z.string() })).min(2),
	}),
]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

// --- Entry / Section / Doc ----------------------------------------------------

const entrySchemaBase = z.object({
	title: z.string(),
	kicker: z.string().optional(),
	description: z.string().optional(),
	descriptionTone: z.enum(["default", "warn"]).optional(),
	code: z.string().optional(),
	codeLanguage: z.string().optional(),
	output: z.string().optional(),
	/**
	 * Mesmo trecho em várias linguagens, renderizado em abas (ex.: PHP e Go num
	 * doc conceitual de arquitetura). Aditivo: docs que não usam ficam iguais.
	 * Quando presente, tem prioridade sobre `code`/`output` na renderização.
	 */
	codeVariants: z
		.array(
			z.object({
				language: z.string(),
				label: z.string().optional(),
				code: z.string(),
				output: z.string().optional(),
			}),
		)
		.optional(),
	span: z.literal("full").optional(),
	tags: z.array(z.string()).default([]),
	callout: calloutSchema.optional(),
	contentBlocks: z.array(contentBlockSchema).optional(),
	/** Permite executar este código no navegador (php-wasm). Opt-in/opt-out por entry. */
	runnable: z.boolean().optional(),
});
const entrySchema = entrySchemaBase;
export type DocEntry = z.infer<typeof entrySchema>;

const sectionSchema = z.object({
	id: z.string(),
	name: z.string(),
	layout: z.enum(["single", "two"]).optional(),
	entries: z.array(entrySchema),
});
export type DocSection = z.infer<typeof sectionSchema>;

const quickStartSchema = z.object({
	title: z.string(),
	kicker: z.string().optional(),
	description: z.string().optional(),
	steps: z.array(z.string()).optional(),
	codeLanguage: z.string().optional(),
	code: z.string().optional(),
	callout: calloutSchema.optional(),
});
export type QuickStart = z.infer<typeof quickStartSchema>;

/**
 * Tecnologias suportadas. `javascript` e `vue` ficam prontos para o conteúdo de
 * front-end (JS primeiro, Vue depois). `arquitetura` é uma categoria conceitual
 * (independente de linguagem): MVC, Clean Architecture, SOLID, etc., com
 * exemplos em PHP e Go no mesmo doc. O agrupamento por categoria na home
 * (Back-end, Front-end, Conceitos, Ferramentas) vive em `src/lib/docs.ts`.
 */
export const TECHS = [
	"git",
	"php",
	"go",
	"javascript",
	"vue",
	"arquitetura",
	"sistemas",
] as const;
export type Tech = (typeof TECHS)[number];

const docs = defineCollection({
	loader: glob({ pattern: "**/*.yaml", base: "./src/content/docs" }),
	schema: z.object({
		id: z.string(),
		title: z.string(),
		subtitle: z.string().optional(),
		/** Blurb curto do card na home (migrado do `docs-manifest`). */
		cardDescription: z.string().optional(),
		searchPlaceholder: z.string().optional(),
		shortcutHint: z.string().optional(),
		codeLanguage: z.string().optional(),
		defaultSectionLayout: z.enum(["single", "two"]).optional(),
		/**
		 * Modo de leitura da doc. `panels` (padrão): cada seção é um painel
		 * trocável pela barra lateral (referência de sintaxe). `narrative`: todas
		 * as seções ficam empilhadas numa página única e a barra vira índice de
		 * capítulos com scroll-spy (docs conceituais de arquitetura). Aditivo:
		 * docs sem o campo seguem em `panels`.
		 */
		readerLayout: z.enum(["panels", "narrative"]).optional(),
		/** Valor padrão de `runnable` para as entries desta doc (sobrescrevível por entry). */
		defaultRunnable: z.boolean().optional(),
		/** Metadados de estudo; ordem e identidade continuam na própria doc. */
		learning: z
			.object({
				module: z.string().min(1),
				kind: z
					.enum(["orientation", "chapter", "laboratory", "project"])
					.default("chapter"),
				level: z.enum(["fundamentos", "intermediario", "avancado"]),
				prerequisites: z.array(z.string()).default([]),
				objectives: z.array(z.string().min(1)).min(1),
			})
			.optional(),
		quickStart: quickStartSchema.optional(),
		sections: z.array(sectionSchema),
		// derivados na migração:
		tech: z.enum(TECHS),
		order: z.number().default(0),
	}),
});

export const collections = { docs };
