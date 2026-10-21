# Autenticação e persistência

O Agendito ainda usa autenticação e persistência exclusivamente no navegador. Sessões e registros no armazenamento local podem ser alterados pelo próprio usuário e não devem ser considerados seguros para produção.

A conta inicial `joao@gmail.com` tem o papel `PLATFORM_ADMIN` e acessa somente a administração geral do Agendito. Ela não é vinculada como administradora de um estabelecimento. Contas `ADMIN` são criadas separadamente para cada estabelecimento. Uma migração local versionada atualiza registros antigos dessa conta e encerra apenas suas sessões antigas de `ADMIN`.

A conta ADMIN estrutural aceita a senha inicial definida para o ambiente mockado. O bundle contém somente um hash-verificador (não a senha em texto), que é gravado no armazenamento local após o primeiro login para habilitar a troca de senha. Esse mecanismo é apenas para desenvolvimento/validação: como a verificação ocorre no navegador, não deve ser tratado como autenticação segura nem usado em produção.

O aplicativo não envia mensagens de recuperação de senha. A tela informa que a recuperação não está disponível, sem confirmar uma operação que não ocorreu.

Antes de disponibilizar o sistema publicamente, a autenticação precisa ser substituída por um backend seguro, com verificação de credenciais no servidor, senhas armazenadas com hash apropriado, sessões protegidas e recuperação de senha por um canal real. Até lá, não cadastre dados pessoais ou comerciais reais em uma implantação pública.

Na primeira abertura após esta versão, a migração guarda uma cópia de recuperação das chaves locais com prefixo `agendito.mock.` e registra os IDs afetados. Em seguida remove apenas essas chaves do armazenamento do Agendito. A cópia fica em `agendito.mock.recovery.snapshot.v1` no armazenamento local do mesmo navegador; ela não é enviada a um servidor. Fixtures automatizadas ficam separadas em `recovery/demo-data-backup-20261021/` e não são carregadas pela aplicação.
