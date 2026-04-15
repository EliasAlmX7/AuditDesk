# 📋 AuditGrão - Sistema de Auditoria Corporativa

O **AuditGrão** é uma ferramenta de alta performance para auditorias de organização e padronização.

## 🚀 Guia de Configuração (Cloudflare + Supabase)

Se você está reconfigurando o sistema ou movendo para um novo banco de dados, siga estas chaves:

### 1. Variáveis de Ambiente (Cloudflare)
No painel da Cloudflare (Settings > Variables), você deve configurar exatamente estas chaves:
- `VITE_SUPABASE_URL`: Sua URL do projeto.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Sua Anon Key pública.
- `VITE_SUPABASE_PROJECT_ID`: O ID do projeto (ex: `ilvbmzicx...`).

### 2. Estrutura do Banco (SQL Editor)
Sempre execute o script de criação das tabelas (`colaboradores`, `auditorias`, `respostas`) no SQL Editor do Supabase antes do primeiro uso.

### 3. Como Importar Colaboradores via CSV
1. No Supabase, vá em **Table Editor**.
2. Selecione a tabela `colaboradores`.
3. Clique no botão **"Insert"** > **"Import data from CSV"**.
4. Arraste seu arquivo CSV.
5. **Atenção**: Certifique-se de que as colunas do seu arquivo coincidam com: `cpf`, `nome`, `area`, `cargo`.

---
*AuditGrão: Eficiência e Transparência na Gestão Corporativa.*
