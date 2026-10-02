# DIGI CONNECT — Escritório Virtual 3D

Escritório virtual no estilo **SoWork / Gather**. É uma maquete isométrica em 3D com personagens
realistas criados num **criador estilo GTA**, áudio e vídeo por proximidade, mesas próprias e reuniões privadas.
Tudo em português, e o banco de dados é **JSON**.

## Versões

- **V1**: primeira versão (avatares chibi). Fica salva na branch `v1`.
- **V2**: avatares realistas, editor do escritório, Sala do Valdinei e Sala da Fran, e pós-produção (SSAO e bloom).
- **V3** (atual): criador de personagem estilo GTA (MakeHuman) e mesas com espaço de conversa próprio.

## O que tem

- **Escritório 3D isométrico**: área de trabalho com 4 ilhas (16 mesas), sala de reunião de vidro,
  2 cabines de foco, lounge, café, recepção e jardim. Tem sombras suaves, plantas balançando e vapor na cafeteira.
- **Criador de personagem estilo GTA**: corpo humano realista (MakeHuman) montado no navegador.
  - **Herança**: modelos prontos, sexo, mistura de ascendência africana, asiática e europeia, tom de pele e cor dos olhos.
  - **Rosto**: formato e ~35 sliders (nariz, olhos, sobrancelhas, maçãs do rosto, boca, lábios, mandíbula, queixo, orelhas, pescoço).
  - **Corpo**: idade, peso, músculos, altura, busto, barriga, ombros, quadril e glúteos.
  - **Visual**: 13 cabelos com qualquer cor, sobrancelhas, barba, bigode e batom.
  - **Roupas**: conjuntos, vestidos, blusas, calças e saias, calçados, chapéu, óculos e headphone.
  - Os personagens andam, **sentam e digitam**, acenam, respiram, piscam, olham em volta e **mexem a boca quando falam**.
    As miniaturas do rosto nas listas são geradas na hora.
- **Salas fixas**: **Sala do Valdinei**, **Sala da Fran**, Sala de Reunião e 2 cabines de foco, todas com vidro e áudio privado.
- **Editor do escritório** (para admins): adicione, mova, gire, recolora, duplique e apague móveis
  (mesas, cadeiras, sofás, plantas, estantes, TV, cozinha, ping-pong, pebolim, fliperama…).
  O layout é salvo no banco JSON e atualiza para todo mundo. A **primeira conta criada vira Admin**,
  e você também pode definir `ADMIN_EMAILS` (separados por vírgula).
- **Visual de jogo**: oclusão de ambiente (SSAO/N8AO), brilho em telas e luminárias, sombras suaves,
  jardim com postes, canteiros e calçada. A qualidade se ajusta sozinha ao computador; use `?q=low` para forçar o modo leve.
- **Mesas**: clique numa mesa livre para atribuir a você. O boneco **anda até ela e senta**.
  Quando você volta ao escritório, já começa sentado na sua mesa.
- **Assentos públicos**: as cadeiras da sala de reunião, o sofá, as poltronas, as banquetas e as cabines também servem para sentar.
- **Microfone e câmera** no dock para ligar e desligar (atalhos `M` e `V`). A câmera aparece numa bolha em cima do avatar.
- **Áudio por proximidade**: o volume cai com a distância. A sala de reunião e as cabines são **zonas privadas**,
  então só quem está dentro se escuta.
- **Cada mesa é um espaço próprio**: duas pessoas sentadas em mesas diferentes não abrem conversa, mesmo vizinhas.
  Quem está em pé só fala com quem está na mesa se chegar pertinho (cerca de 1,3 m).
- **Reuniões privadas**: convide pessoas e a chamada conecta só entre vocês, de qualquer lugar do escritório.
- **Status**: Ativo, Ocupado (microfone sempre mudo) e Ausente (sai das conversas).
- **Emojis** 👋 ❤️ 😂 🎉 👍 (teclas 1 a 5), minimapa clicável, clique para andar (com desvio de móveis), WASD e joystick no celular.
- A **tela de login** mostra o escritório ao vivo, com figurantes andando e trabalhando.

## Stack

- Front-end: **Vite + Three.js** (JavaScript puro, sem framework de UI).
- API: uma Vercel Function em `api/index.js`, que fica em `POST /api`.
- Tempo real: **WebRTC P2P**. Posição a ~15 Hz por data channel. Áudio e vídeo vão só para quem está no alcance.
  A sinalização passa pela API.
- Banco: **JSON** (`lib/db.js`).

## Banco de dados JSON

Cada coleção é um documento JSON `{ id: registro }`:

| Coleção    | Conteúdo                                   |
|------------|--------------------------------------------|
| `users`    | usuários, avatar, status (senha com scrypt)|
| `emails`   | e-mail → id (garante e-mail único)         |
| `desks`    | mesa → dono                                |
| `meetings` | reuniões privadas e participantes          |
| `presence` | quem está online, posição, mic/câmera      |
| `layout`   | móveis do escritório (editor)              |

- **Local**: os arquivos ficam em `data/*.json`.
- **Na Vercel**: o disco das funções é temporário. Por isso os **mesmos documentos JSON** são guardados no
  **Upstash Redis** (tem plano grátis). O driver é escolhido sozinho pelas variáveis de ambiente.
  Sem o Redis o app funciona em *modo demonstração* (dados temporários) e mostra um aviso na tela.

## Rodar local

```bash
npm install
npm run dev        # http://localhost:5173
```

Para testar a proximidade, abra duas janelas (uma anônima) e crie duas contas.

## Subir na Vercel (direto do Git)

1. Em **vercel.com → Add New → Project**, importe este repositório. O framework **Vite** é detectado sozinho.
2. No projeto, vá em **Storage → Marketplace → Upstash (Redis)**, crie o banco grátis e **conecte ao projeto**.
   As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` entram automaticamente.
3. Opcional, em **Settings → Environment Variables**:
   - `SESSION_SECRET`: um texto aleatório comprido, para assinar o login.
   - `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`: um servidor TURN para chamadas em redes
     corporativas muito fechadas. Pode ser um do metered.ca, Twilio ou Cloudflare Calls.
4. Faça **Redeploy**. Cada `git push` publica de novo automaticamente.

> Câmera e microfone exigem **HTTPS**. A Vercel já entrega HTTPS.

## Estrutura

```
api/index.js          Vercel Function (POST /api)
lib/actions.js        ações: login, sync, mesas, reuniões, status, avatar
lib/db.js             banco JSON (arquivo local ou Upstash Redis)
lib/auth.js           senha (scrypt) + sessão em cookie assinado
shared/layout.js      planta do escritório, mesas, assentos, zonas (servidor + cliente)
src/main.js           app: cena, câmera, controles, mídia, UI
shared/catalog.js     catálogo de móveis do editor
src/editor.js         editor do escritório
src/three/structure.js  estrutura fixa (paredes, salas, jardim)
src/three/furniture.js  móveis (um construtor 3D por tipo)
shared/avatar.js      opções e sliders do criador de personagem (cliente + servidor)
src/three/mh.js       monta o personagem: morphs, roupas/cabelo encaixados, esqueleto
src/three/human.js    avatar + animação procedural por osso
src/three/thumbs.js   miniaturas do rosto
tools/bake-mh.mjs     converte os dados do MakeHuman para public/mh/
src/three/kit.js      texturas procedurais e primitivas arredondadas
public/mh/            corpo, morphs, roupas, cabelos e texturas (gerados pelo tools/bake-mh.mjs)
src/rtc.js            malha WebRTC (P2P)
src/nav.js            pathfinding A*
dev-server.js         servidor local (API + Vite)
```

## Créditos

- Personagens: [MakeHuman](http://www.makehumancommunity.org) (malha base, alvos de forma, esqueleto, cabelos e roupas; assets do sistema em CC0,
  assets da comunidade conforme a licença de cada um) e textura de pele do [MPFB](https://github.com/makehumancommunity/mpfb2) (CC0).
- Oclusão de ambiente: [N8AO](https://github.com/N8python/n8ao). Pós-produção: [postprocessing](https://github.com/pmndrs/postprocessing).
