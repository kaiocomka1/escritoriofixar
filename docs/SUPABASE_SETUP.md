# Supabase — Fixar+ AI Office

## Passo 1: variáveis de ambiente
Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY
somente em Vercel > Settings > Environment Variables (Production).
Faça redeploy. Teste /api/supabase/status; ele verifica apenas presença.

## Passo 2: criar tabelas
No Supabase > SQL Editor > New query, cole e execute
supabase/migrations/20261107_001_initial.sql.
Confira em Table Editor: profiles, marketplace_stores,
integration_credentials, integration_events.

## Passo 3: autenticação administrativa (pendente)
Criar usuário via Supabase Authentication. Associar UUID ao papel admin
em profiles somente após verificar a identidade do administrador.
Não expor a secret key no navegador.

## Limites desta versão
- As tabelas estão definidas no SQL, mas precisam ser executadas manualmente.
- Endpoint de status não testa conexão real ao banco.
- OAuth Shopee permanece desativado.
- Não armazenar tokens até implementar criptografia AES-GCM e controle de acesso.
- Não inserir senhas ou tokens em tickets, prints ou repositório.
