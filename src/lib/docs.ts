/**
 * Camada de acesso ao conteúdo: consulta a coleção `docs`, agrupa por
 * tecnologia e expõe metadados de cada tech (rótulo, ícone, tagline).
 * Isola os componentes visuais da forma de armazenamento do conteúdo.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { TECHS, type Tech } from "@/content.config";
import { validateLearningGraph } from "./learning";

export type DocEntry = CollectionEntry<"docs">;

export interface TechMeta {
	label: string;
	/** Rótulo curto para breadcrumbs/chips. */
	short: string;
	tagline: string;
	/** Ícone Iconify (astro-icon). */
	icon: string;
	/**
	 * Hue de marca calibrado para o fundo escuro (luminoso, não neon). Aplicado
	 * de forma escopada em cards, landings e páginas de leitura da tecnologia.
	 */
	accent: string;
}

export const TECH_META: Record<Tech, TechMeta> = {
	sistemas: {
		label: "Engenharia de Dados & Sistemas Distribuídos",
		short: "Sistemas",
		tagline:
			"Dos mecanismos de armazenamento à operação de sistemas cloud native.",
		icon: "lucide:network",
		accent: "var(--color-tone-hint)",
	},
	php: {
		label: "PHP",
		short: "PHP",
		tagline: "Do dia a dia ao back-end: dados, APIs, sessões e segurança.",
		icon: "simple-icons:php",
		accent: "#a9b4e6",
	},
	go: {
		label: "Go",
		short: "Go",
		tagline: "Fundamentos idiomáticos, concorrência e biblioteca padrão.",
		icon: "simple-icons:go",
		accent: "#5dc9e2",
	},
	git: {
		label: "Git & GitHub",
		short: "Git",
		tagline: "Fluxo de terminal, branches e desfazer com confiança.",
		icon: "simple-icons:git",
		accent: "#e8825a",
	},
	javascript: {
		label: "JavaScript",
		short: "JS",
		tagline: "A linguagem da web: tipos, funções, assíncrono e o DOM.",
		icon: "simple-icons:javascript",
		accent: "#e8c34a",
	},
	vue: {
		label: "Vue",
		short: "Vue",
		tagline: "Componentes, reatividade e composição — em breve.",
		icon: "simple-icons:vuedotjs",
		accent: "#5fc98e",
	},
	arquitetura: {
		label: "Arquitetura",
		short: "Arq",
		tagline:
			"Padrões, camadas e decisões de estrutura — independentes de linguagem.",
		icon: "lucide:layers",
		accent: "#c58bd6",
	},
};

/**
 * Ordem de exibição das tecnologias. Determina a ordem **dentro** de cada
 * categoria na home (JS antes de Vue no Front-end, PHP antes de Go no Back-end).
 */
export const TECH_ORDER: Tech[] = [
	"sistemas",
	"php",
	"go",
	"javascript",
	"vue",
	"arquitetura",
	"git",
];

/**
 * Categorias da home. São um agrupamento **visual** (faixas), não um nível de
 * navegação: cada tech continua a um clique da home e nenhuma URL muda. Uma tech
 * pertence a exatamente uma categoria (ver `TECH_CATEGORY`). UI/UX, no futuro,
 * entra em `conceitos` ao lado de `arquitetura`.
 */
export type Category =
	"formacao" | "backend" | "frontend" | "conceitos" | "ferramentas";

export interface CategoryMeta {
	/** Rótulo da faixa (eyebrow). */
	label: string;
	/**
	 * `stack`: linguagens/frameworks que se estuda — faixa + techs em grade de
	 * 2 colunas com chips de docs. `reference`: consulta transversal (arquitetura,
	 * git) — linhas compactas no rodapé, sem chips. Ao crescer para várias techs,
	 * uma `reference` pode ser promovida a `stack` (só trocar o campo).
	 */
	variant: "stack" | "reference";
	/** Marca a categoria como recém-adicionada (pílula "novo" na faixa). */
	isNew?: boolean;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
	formacao: { label: "Formação avançada", variant: "stack", isNew: true },
	backend: { label: "Back-end", variant: "stack" },
	frontend: { label: "Front-end", variant: "stack", isNew: true },
	conceitos: { label: "Conceitos", variant: "reference" },
	ferramentas: { label: "Ferramentas", variant: "reference" },
};

/** Ordem das faixas na home. */
export const CATEGORY_ORDER: Category[] = [
	"formacao",
	"backend",
	"frontend",
	"conceitos",
	"ferramentas",
];

/** A qual categoria cada tech pertence. */
export const TECH_CATEGORY: Record<Tech, Category> = {
	sistemas: "formacao",
	php: "backend",
	go: "backend",
	javascript: "frontend",
	vue: "frontend",
	arquitetura: "conceitos",
	git: "ferramentas",
};

function byOrder(a: DocEntry, b: DocEntry): number {
	return (a.data.order ?? 0) - (b.data.order ?? 0);
}

/** Todas as docs, ordenadas pelo `order` do manifesto. */
export async function getAllDocs(): Promise<DocEntry[]> {
	const docs = await getCollection("docs");
	validateLearningGraph(docs);
	return docs.sort(byOrder);
}

/** Docs de uma tecnologia, ordenadas. */
export async function getDocsByTech(tech: Tech): Promise<DocEntry[]> {
	const docs = await getCollection("docs", (d) => d.data.tech === tech);
	return docs.sort(byOrder);
}

/** Mapa tech -> docs (apenas techs com ao menos uma doc). */
export async function getDocsGroupedByTech(): Promise<
	{ tech: Tech; meta: TechMeta; docs: DocEntry[] }[]
> {
	const all = await getAllDocs();
	const groups: { tech: Tech; meta: TechMeta; docs: DocEntry[] }[] = [];
	for (const tech of TECH_ORDER) {
		const docs = all.filter((d) => d.data.tech === tech);
		if (docs.length > 0) {
			groups.push({ tech, meta: TECH_META[tech], docs });
		}
	}
	return groups;
}

export interface TechGroup {
	tech: Tech;
	meta: TechMeta;
	docs: DocEntry[];
}

export interface CategoryGroup {
	category: Category;
	meta: CategoryMeta;
	/** Techs desta categoria que têm ao menos uma doc, na ordem de `TECH_ORDER`. */
	groups: TechGroup[];
}

/**
 * Docs agrupadas por categoria e, dentro, por tech (para as faixas da home).
 * Reusa `getDocsGroupedByTech()` — herda a ordem de `TECH_ORDER` e o filtro de
 * "só techs com ≥1 doc". Categorias sem nenhuma tech populada são omitidas.
 */
export async function getDocsGroupedByCategory(): Promise<CategoryGroup[]> {
	const techGroups = await getDocsGroupedByTech();
	const result: CategoryGroup[] = [];
	for (const category of CATEGORY_ORDER) {
		const groups = techGroups.filter((g) => TECH_CATEGORY[g.tech] === category);
		if (groups.length > 0) {
			result.push({ category, meta: CATEGORY_META[category], groups });
		}
	}
	return result;
}

/**
 * Título curto para os chips da home: remove o prefixo `"<Label>: "` do título
 * (ex.: "PHP: Fundamentos" → "Fundamentos"), já que o chip vive sob o bloco da
 * própria tech. Se o título não tiver esse prefixo, devolve-o inteiro.
 */
export function docShortTitle(doc: DocEntry): string {
	const { title, tech } = doc.data;
	const prefix = `${TECH_META[tech].label}: `;
	return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

/**
 * Escopo visual de uma tecnologia. Reusa os tokens globais já consumidos pelos
 * componentes, mas só dentro do container que recebe este style.
 */
export function techAccentVars(accent: string): string {
	return [
		`--color-accent: ${accent}`,
		`--color-accent-strong: color-mix(in oklab, ${accent} 72%, white)`,
		`--color-accent-dim: color-mix(in oklab, ${accent} 72%, black)`,
		`--accent-soft: color-mix(in oklab, ${accent} 16%, transparent)`,
		`--accent-faint: color-mix(in oklab, ${accent} 8%, transparent)`,
		`--glow-accent: 0 0 60px -12px color-mix(in oklab, ${accent} 45%, transparent)`,
		`--glow-accent-sm: 0 0 24px -8px color-mix(in oklab, ${accent} 40%, transparent)`,
		`--halo-accent: radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, ${accent} 12%, transparent), transparent 70%)`,
	].join("; ");
}

/** Techs válidas (type guard). */
export function isTech(value: string): value is Tech {
	return (TECHS as readonly string[]).includes(value);
}
