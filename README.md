# 📋 AuditGrão - Sistema de Auditoria Corporativa

O **AuditGrão** é uma aplicação moderna voltada para auditorias de organização, 5S e padronização em ambientes de escritório corporativo. Desenvolvido com foco na usabilidade em tablets, o sistema oferece uma interface fluida, profissional e eficiente.

## ✨ Diferenciais do Sistema
- **Interface Premium**: Design corporativo utilizando a fonte Montserrat e paleta de cores personalizada (Verde, Cinza Escuro e Marrom).
- **Otimizado para Tablets**: Botões amplos de "Conforme" e "Não Conforme" facilitando o uso em campo.
- **Observações Detalhadas**: Campo de justificativa individual para cada critério de auditoria.
- **Resiliência de Dados**: Sistema de persistência local (Auto-save) que evita a perda de informações caso a página seja atualizada ou a internet oscile.
- **Sincronização Cloud**: Integração em tempo real com banco de dados Supabase (PostgreSQL).

## 🚀 Tecnologias Utilizadas
- **Frontend**: React + Vite
- **Roteamento**: TanStack Router / Start
- **Estilização**: Tailwind CSS (Custom Theme)
- **Backend/DB**: Supabase
- **Infraestrutura**: Cloudflare Pages / Workers

## 🛠️ Configuração do Ambiente
Para rodar este projeto online, é necessário configurar as seguintes variáveis de ambiente (Environment Variables) no painel de hospedagem:

- `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave anônima pública de API.
- `VITE_SUPABASE_PROJECT_ID`: ID único do projeto.

---
*Desenvolvido para ambientes corporativos de alta performance.*
