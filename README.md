# Datime — Dá time

Aplicação leve para gerenciar times de vôlei: cadastro de jogadores por grupo, formação balanceada de Time A e B, contagem de pontos por set e remistura ao final de cada set.

## Como rodar

A aplicação usa ES modules. Abra com um servidor HTTP local, por exemplo:

```bash
# Python 3
python3 -m http.server 8080

# Node (npx)
npx serve .

# Ou abra pelo Cursor / VS Code Live Server
```

Depois acesse `http://localhost:8080` (ou a porta indicada).

## Uso

1. **Aba Jogadores**: crie grupos (ex.: Grupo 1, 2), cadastre jogadores (nome + grupo), defina jogadores por time, pontos máximos por set e nível de remistura (Pouco / Normal / Muito). Use "Limpar tudo" para apagar todos os dados (com confirmação).
2. **Aba Time**: veja Time A, Time B e reservas (formados automaticamente ao abrir a aba). Toque nos botões grandes para marcar ponto do Time A ou B. Ao atingir o máximo de pontos, o set é finalizado, os times são remisturados e o histórico aparece no fim da página. Use "Encerrar set" para terminar o set antes (ex.: desistência).

Dados são salvos automaticamente no `localStorage` do navegador.
