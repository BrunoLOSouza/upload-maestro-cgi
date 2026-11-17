# UploadMaestroAngular

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.16.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Postos previstos e serviços extras

O seletor principal da escala oferece somente os postos previstos na planilha
para a unidade, base e atendimento escolhidos. Postos além dessa previsão ficam
em **Serviços extras (opcional)**, com inclusão explícita pelo operador e SLA
manual obrigatório. Não há mudança nos nomes nem nas colunas de exportação.

Validação: `node verify_service_scope.cjs` confronta os atendimentos com a planilha
SLA de referência disponível em Downloads, além de verificar inclusão de extras,
sinais do SLA, repetição, restauração e exportação. A versão no navegador pode
ser verificada com `node verify_service_scope_browser.cjs`, usando um Chrome de
testes na porta 9223. O endereço pode ser definido por `OPERA_BROWSER_URL`.

Antes de incluir o voo no despacho, postos extras ou previstos ausentes geram
um alerta com os nomes envolvidos. Cancelar preserva o formulário; somente OK
libera a inclusão quando houver diferenças. A confirmação não envia o voo ao
sistema da empresa, apenas o inclui no lote da aplicação.

## TPS 3 e horário de referência

Em GOL/GRU/INTERNACIONAL, TPS 3 é previsto somente antes das 12:00. O SLA é fixo:
240 minutos contratuais e -240 no upload, sem digitação manual. A partir de 12:00
ele não aparece nem é considerado ausente. O relógio aceita intervalos de 5
minutos, sem arredondar valores inválidos.

O modelo de upload disponível ainda não possui as colunas do TPS 3 e do seu
colaborador. A exportação de lotes com esse posto fica protegida até confirmar
os cabeçalhos. Os demais lotes continuam exportando normalmente.
