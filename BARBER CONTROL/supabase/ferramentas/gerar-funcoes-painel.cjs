// Gera versões de ARQUIVO ÚNICO das Edge Functions (o código de
// _shared/http.ts embutido), para colar no editor do painel do Supabase
// (Edge Functions → Deploy a new function → Via Editor), sem Supabase CLI.
//
// Uso (na pasta BARBER CONTROL):  node supabase/ferramentas/gerar-funcoes-painel.cjs
// Rode de novo sempre que alterar supabase/functions/.
const fs = require("fs");
const path = require("path");

const base = path.join(__dirname, "..", "functions");
const destino = path.join(__dirname, "..", "funcoes-para-o-painel");
fs.mkdirSync(destino, { recursive: true });

const compartilhado = fs.readFileSync(path.join(base, "_shared", "http.ts"), "utf8");

for (const nome of ["control-login", "control-admin", "cobranca"]) {
    const fonte = fs.readFileSync(path.join(base, nome, "index.ts"), "utf8");
    const linhaImport = /^import \{[^}]+\} from "\.\.\/_shared\/http\.ts";\r?\n/m;
    if (!linhaImport.test(fonte)) throw new Error(`${nome}: import de _shared/http.ts não encontrado`);
    const unico = fonte.replace(linhaImport, () =>
        `\n// ----- código de _shared/http.ts (embutido para o editor do painel) -----\n${compartilhado}\n// ----- fim do código compartilhado -----\n\n`);
    const cabecalho = `// ARQUIVO GERADO por supabase/ferramentas/gerar-funcoes-painel.cjs — não edite aqui.\n` +
        `// Cole no painel do Supabase: Edge Functions → Deploy a new function → Via Editor,\n` +
        `// nome da função: ${nome}. Depois, em Settings da função, DESLIGUE "Verify JWT".\n\n`;
    fs.writeFileSync(path.join(destino, `${nome}.ts`), cabecalho + unico);
    console.log(`gerado: funcoes-para-o-painel/${nome}.ts`);
}
