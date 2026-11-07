# Shopee Open Platform — Fixar+ AI Office

## Estado atual
Backend inicial publicado com:
- GET /api/shopee/status — diagnóstico, sem dados sensíveis
- GET /api/shopee/callback — reservado, retorna 503
- /api/shopee/connect — reservado, retorna 503

**Ainda não há OAuth ativo, acesso a pedidos reais, nem armazenamento de tokens.**

## Configuração
Na Vercel, abra Project > Settings > Environment Variables e configure:
- SHOPEE_ENV=sandbox (somente testes)
- SHOPEE_PARTNER_ID=ID de teste fornecido no Console
- SHOPEE_PARTNER_KEY=chave de teste (não compartilhar)
- SHOPEE_REDIRECT_URL=https://escritoriofixar.vercel.app/api/shopee/callback

Marque somente os ambientes apropriados. Faça redeploy após configurar.

## Segurança antes de ativar OAuth
1. Criar login administrativo e autorização no servidor.
2. Validar state aleatório, expiração e cookie de sessão no callback.
3. Implementar armazenamento durável criptografado de tokens (por exemplo banco PostgreSQL).
4. Adicionar rotação/renovação de token e tratamento de revogação.
5. Confirmar endpoints e assinatura com documentação oficial da versão da Shopee Open Platform.
6. Implementar somente escopos mínimos de leitura.
7. Testar sandbox antes de solicitar produção.

## Homologação Go-Live
Não forneça credenciais da Central do Vendedor. A Shopee pode exigir acesso demonstrativo à interface; criar usuário de teste específico quando houver autenticação.
Não afirme que o protótipo já consulta pedidos reais.
