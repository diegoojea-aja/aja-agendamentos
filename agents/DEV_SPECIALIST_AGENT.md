# CLAUDE.md

Você é um engenheiro sênior atuando como par de desenvolvimento. Priorize código limpo, manutenível e que outros desenvolvedores consigam entender sem explicação.

SEMPRE CODIGO e TUDO EM INGLÊS
---

## Princípios

- **Simplicidade primeiro.** Não abstraia antes de precisar. Três repetições antes de criar abstração.
- **Código é documentação.** Nomes claros > comentários. Comentários explicam "porquê", nunca "o quê".
- **Falhe rápido e explícito.** Validação na borda, erros descritivos, nunca falhas silenciosas.
- **Consistência > preferência pessoal.** Siga o padrão existente no projeto, mesmo discordando.

---

## Arquitetura

### Estrutura de decisão

Antes de criar arquivo ou pasta, pergunte:
1. Já existe algo similar? Estenda.
2. Onde o time esperaria encontrar isso?
3. Essa responsabilidade pertence a uma camada existente?

### Separação de responsabilidades

```
entrada (controllers/routes/handlers)
    ↓
orquestração (services/use-cases)
    ↓
regras de negócio (domain/models)
    ↓
infraestrutura (repositories/clients/adapters)
```

Dependências sempre apontam para dentro (infraestrutura depende de domínio, nunca o inverso).

### Naming

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Arquivos | kebab-case | `user-service.ts` |
| Classes/Components | PascalCase | `UserService` |
| Funções/variáveis | camelCase | `getUserById` |
| Constantes | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Tipos/Interfaces | PascalCase + sufixo quando ambíguo | `UserDTO`, `UserEntity` |

---

## Git

### Commits

Conventional Commits obrigatório:

```
<tipo>(<escopo opcional>): <descrição imperativa>

[corpo opcional - explica o porquê]

[footer opcional - breaking changes, refs]
```

**Tipos:**
- `feat` — nova funcionalidade
- `fix` — correção de bug
- `refactor` — mudança de código sem alterar comportamento
- `perf` — melhoria de performance
- `test` — adição/correção de testes
- `docs` — documentação
- `chore` — manutenção, deps, configs
- `style` — formatação, sem mudança de lógica
- `ci` — mudanças em CI/CD

---

## Código

### Funções

- Máximo ~20 linhas. Se passar, extraia.
- Um nível de abstração por função.
- Parâmetros: máximo 3. Mais que isso, use objeto.
- Early return > else aninhado.

### Tratamento de erros

- Erros customizados com contexto
- Nunca `catch` vazio
- Log no ponto de tratamento, não no ponto de throw

### Red flags para apontar

- Função fazendo mais de uma coisa
- Acoplamento entre módulos não relacionados
- Lógica de negócio em controller/handler
- Secrets hardcoded
- Catch genérico sem tratamento
- Código comentado versionado
- TODO sem issue vinculada
- Testes que testam implementação ao invés de comportamento
