# DIGI CONNECT — Escritório Virtual 3D

Escritório virtual no estilo **SoWork / Gather**. É uma maquete isométrica em 3D com personagens
realistas criados num **criador estilo GTA**, áudio e vídeo por proximidade, mesas próprias e reuniões privadas.
Tudo em português, e o banco de dados é **JSON**.

## Versões

- **V1**: primeira versão (avatares chibi). Fica salva na branch `v1`.
- **V2**: avatares realistas, editor do escritório, Sala do Valdinei e Sala da Fran, e pós-produção (SSAO e bloom).
- **V3**: criador de personagem estilo GTA (MakeHuman) e mesas com espaço de conversa próprio.
- **V4** (atual): chat (DMs, canais, mídia, áudio, recado de vídeo, GIF, visualização única), notificações push,
  quadradinhos de chamada, compartilhamento de tela, app instalável (PWA) e banco no **Supabase**.

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
- **Microfone, câmera e tela** no dock (atalhos `M` e `V`). Em qualquer conversa aparecem **quadradinhos no topo**
  (estilo SoWork) com cada pessoa: vídeo ou o rosto do personagem, quem está falando fica com borda verde.
  Clique num quadradinho para ampliar. Na **reunião privada** a câmera também aparece na bolha em cima do avatar.
- **Compartilhar a tela**: quem está na conversa com você vê sua tela num quadro maior (dá para abrir em tela cheia).
- **Mensagens**: conversas privadas e **canais `#nome`** com quem você escolher. Texto, fotos, vídeos, arquivos,
  **GIFs** (GIPHY), **recado de áudio** (segure o microfone, deslize para cancelar ou para cima para travar),
  **recado de vídeo** (bolinha de até 1 min) e **visualização única** (a pessoa abre uma vez e o arquivo é apagado).
- **Notificações**: aviso dentro do app, contador de não lidas e **push** no celular/computador mesmo com o app fechado.
- **App no celular**: instale pela tela inicial (PWA). No celular ele vira um app com abas: Escritório, Mensagens, Pessoas e Você.
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
- Banco: **JSON** (`lib/db.js`), guardado no **Supabase (Postgres)** em produção.
- Arquivos do chat: **Supabase Storage** (bucket `digi-chat`, criado sozinho).

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

| `channels` | conversas privadas e canais                |
| `reads`    | até onde cada pessoa já leu                |
| `push`     | aparelhos inscritos para notificação       |

As mensagens ficam em listas (`m:<conversa>`), em ordem de chegada.

- **Supabase (recomendado)**: cada registro vira uma linha JSON (`jsonb`) nas tabelas `digi_kv`, `digi_list` e `digi_meta`,
  criadas sozinhas na primeira requisição, com RLS ligado (a chave pública do Supabase não enxerga nada).
- **Local**: os arquivos ficam em `data/*.json` (ou num Postgres local com `SUPABASE_DB_URL`).
- Também funciona com Upstash Redis. Sem nenhum banco na Vercel, o app roda em *modo demonstração* (os dados somem).

## Rodar local

```bash
npm install
npm run dev        # http://localhost:5173
```

Para testar a proximidade, abra duas janelas (uma anônima) e crie duas contas.

## Subir na Vercel (direto do Git)

1. Em **vercel.com → Add New → Project**, importe este repositório. O framework **Vite** é detectado sozinho.
2. No projeto, vá em **Storage → Create Database → Supabase**, crie (tem plano grátis) e **conecte ao projeto**.
   As variáveis `POSTGRES_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` entram sozinhas.
   Se o Supabase já existe: em **Settings → Environment Variables** coloque `SUPABASE_DB_URL` (Connection string →
   Transaction pooler), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. Opcional, em **Settings → Environment Variables**:
   - `GIPHY_API_KEY`: chave grátis do [GIPHY](https://developers.giphy.com) para buscar GIFs.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: chaves do push (sem elas, são geradas e guardadas no banco).
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
lib/chat.js           mensagens, canais, visualização única, GIFs
lib/files.js          uploads (Supabase Storage, Vercel Blob ou disco local)
lib/push.js           notificações push (Web Push)
src/chat.js           tela de mensagens, gravação de áudio/vídeo
public/sw.js          service worker (app instalável + push)
dev-server.js         servidor local (API + Vite)
```

## Créditos

- Personagens: [MakeHuman](http://www.makehumancommunity.org) (malha base, alvos de forma, esqueleto, cabelos e roupas; assets do sistema em CC0,
  assets da comunidade conforme a licença de cada um) e textura de pele do [MPFB](https://github.com/makehumancommunity/mpfb2) (CC0).
- Oclusão de ambiente: [N8AO](https://github.com/N8python/n8ao). Pós-produção: [postprocessing](https://github.com/pmndrs/postprocessing).
