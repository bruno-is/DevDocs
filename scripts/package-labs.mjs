/** ZIP determinístico, sem dependências/runtime extra no build do Pages. */
import {
	readdirSync,
	readFileSync,
	writeFileSync,
	lstatSync,
	mkdirSync,
} from "node:fs";
import { join } from "node:path";

const directory = "labs/sistemas";
const allowedFiles = new Set([
	"README.md",
	"erp.py",
	"test_erp.py",
	"register_connector.py",
	"compose.yaml",
	"connector.json",
	"k8s.yaml",
	"sql/init.sql",
	"sql/performance.sql",
	"sql/session-a.sql",
	"sql/session-b.sql",
]);
const entries = [];
function collect(dir, prefix = "sistemas/") {
	for (const name of readdirSync(dir).sort()) {
		if (name.startsWith(".") || name === "__pycache__" || name.endsWith(".pyc"))
			continue;
		const path = join(dir, name);
		const stat = lstatSync(path);
		if (stat.isSymbolicLink())
			throw new Error(`Link não permitido no pacote: ${path}`);
		if (stat.isDirectory()) collect(path, `${prefix}${name}/`);
		else if (allowedFiles.has(`${prefix}${name}`.slice("sistemas/".length)))
			entries.push({
				name: Buffer.from(`${prefix}${name}`, "utf8"),
				body: readFileSync(path),
			});
	}
}
collect(directory);
if (entries.length !== allowedFiles.size) {
	const included = new Set(
		entries.map((entry) =>
			entry.name.toString("utf8").slice("sistemas/".length),
		),
	);
	throw new Error(
		`Fontes ausentes no pacote: ${[...allowedFiles].filter((name) => !included.has(name)).join(", ")}`,
	);
}
const table = Array.from({ length: 256 }, (_, value) => {
	for (let bit = 0; bit < 8; bit++)
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	return value >>> 0;
});
function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}
const local = [],
	central = [];
let offset = 0;
for (const { name, body } of entries) {
	const crc = crc32(body);
	const header = Buffer.alloc(30);
	header.writeUInt32LE(0x04034b50);
	header.writeUInt16LE(20, 4);
	header.writeUInt16LE(0x0800, 6);
	header.writeUInt16LE(0x5c21, 12); // 2026-01-01
	header.writeUInt32LE(crc, 14);
	header.writeUInt32LE(body.length, 18);
	header.writeUInt32LE(body.length, 22);
	header.writeUInt16LE(name.length, 26);
	local.push(header, name, body);
	const record = Buffer.alloc(46);
	record.writeUInt32LE(0x02014b50);
	record.writeUInt16LE(20, 4);
	record.writeUInt16LE(20, 6);
	record.writeUInt16LE(0x0800, 8);
	record.writeUInt16LE(0x5c21, 14);
	record.writeUInt32LE(crc, 16);
	record.writeUInt32LE(body.length, 20);
	record.writeUInt32LE(body.length, 24);
	record.writeUInt16LE(name.length, 28);
	record.writeUInt32LE(offset, 42);
	central.push(record, name);
	offset += header.length + name.length + body.length;
}
const index = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(index.length, 12);
end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...local, index, end]);
mkdirSync("public/labs", { recursive: true });
writeFileSync("public/labs/sistemas.zip", archive);
console.log(
	`Laboratórios: ${entries.length} arquivos, ${archive.length} bytes no ZIP.`,
);
