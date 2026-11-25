# Lançar uma funcionalidade nova (site mãe → todas)

Desde a migração 15, o módulo **Funcionalidades** do Barber Control liga e
desliga novidades nos sites e painéis das barbearias.

## Situações

| Situação | Quem vê |
|---|---|
| Planejada / Desligada | Ninguém |
| **Em teste** | Só a Navalha de Ouro (site mãe) e as barbearias piloto |
| **Liberada para todas** | Todas as barbearias |

## Passo a passo (você, no Barber Control)

1. **Nova funcionalidade**: nome, descrição e o **código** combinado com quem
   programou (ex.: `fidelidade`). A descrição vira o texto do comunicado.
2. **Colocar em teste**: aparece só na Navalha de Ouro. Opcional: **Pilotos**
   para escolher outras barbearias que testam junto.
3. Teste no site mãe. Se der problema: **Desligar** (some na hora).
4. **Liberar para todas**: aparece em todas, os donos recebem o comunicado
   "Novidade: …" e fica registrado no Histórico.

Funcionalidade sem código fica só como registro (não liga nada).

## Para quem programa a novidade

O site e o painel já carregam `tenant-cliente.js`, que expõe:

```js
// Em JavaScript
if (await BarbeariaAtual.tem("fidelidade")) {
    // mostra a novidade
}
```

```html
<!-- Em HTML: fica escondido até a funcionalidade estar ligada -->
<button data-funcionalidade="fidelidade">Meus pontos</button>
```

Conteúdo criado depois do carregamento: chame
`BarbeariaAtual.mostrarFuncionalidades()`.

**No banco**, funções novas que só devem funcionar com a novidade ligada
conferem com `control.funcionalidade_ligada('fidelidade', barbearia_id)`.
Assim ninguém liga a novidade mexendo no navegador.

Regras:
- O código da novidade é publicado para todos, mas fica escondido até ser
  ligado. Mudanças em telas que já existem precisam manter a versão antiga
  funcionando quando a funcionalidade estiver desligada.
- Migrações de uma novidade só **adicionam** (tabelas, colunas, funções);
  nada que quebre as barbearias que ainda não têm a novidade.
