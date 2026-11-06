# Fixar+ AI Office — MVP web 1.0

Protótipo React + Vite com escritório virtual, personagens, tarefas, importação CSV e alertas ROAS.

## Como executar

Requer Node.js 20+.

```bash
npm install
npm run dev
```

## Produção

```bash
npm run build
```

Publique na Vercel: Framework **Vite**, comando **npm run build**, diretório **dist**.

## Limitações e segurança

- Agentes são personagens demonstrativos, ainda **sem execução IA**.
- Cargoos MCP ainda **não está conectado**. A autenticação deve ocorrer em servidor protegido, nunca no frontend.
- Sem login ou banco compartilhado: tarefas e arquivos importados ficam somente no localStorage do navegador.
- Dados financeiros são estimativas simplificadas e não substituem conciliação real.
- Importação funciona com CSV (vendas: `total,quantidade,ads,outros`; campanhas: `campanha,roas`).
- **Não importe dados pessoais ou comerciais sigilosos em uma instalação pública sem autenticação.**

## Próximas fases

Autenticação, backend, cliente MCP Cargoos com descoberta de ferramentas, motor de agentes, auditoria e aprovações antes de mudanças externas.
