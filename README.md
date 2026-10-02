# DIGI CONNECT — Escritório Virtual 3D

Escritório virtual no estilo **SoWork / Gather**. É uma maquete isométrica em 3D com bonequinhos
chibi customizáveis, áudio e vídeo por proximidade, mesas próprias e reuniões privadas.
Tudo em português, e o banco de dados é **JSON**.

## O que tem

- **Escritório 3D isométrico**: área de trabalho com 4 ilhas (16 mesas), sala de reunião de vidro,
  2 cabines de foco, lounge, café, recepção e jardim. Tem sombras suaves, plantas balançando e vapor na cafeteira.
- **Avatares chibi** que você monta: tom de pele, 6 cabelos, cores, camiseta, calça e acessório
  (óculos, headphone, boné, gorro). Eles piscam, respiram, andam, **sentam** e acenam.
- **Mesas**: clique numa mesa livre para atribuir a você. O boneco **anda até ela e senta**.
  Quando você volta ao escritório, já começa sentado na sua mesa.
- **Assentos públicos**: as cadeiras da sala de reunião, o sofá, as poltronas, as banquetas e as cabines também servem para sentar.
- **Microfone e câmera** no dock para ligar e desligar (atalhos `M` e `V`). A câmera aparece numa bolha em cima do avatar.
- **Áudio por proximidade**: o volume cai com a distância. A sala de reunião e as cabines são **zonas privadas**,
  então só quem está dentro se escuta.
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
src/three/office.js   escritório 3D procedural
src/three/avatar.js   avatares chibi + animações
src/three/kit.js      texturas procedurais e primitivas arredondadas
src/rtc.js            malha WebRTC (P2P)
src/nav.js            pathfinding A*
dev-server.js         servidor local (API + Vite)
```
