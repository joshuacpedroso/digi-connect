// Pinta a textura do personagem (layout UV dos "Animated Characters" da Kenney, CC0)
// a partir da configuração do avatar: pele, cabelo, rosto, roupa, calça e tênis.
// Coordenadas no espaço 1024×1024 do atlas original.
import * as THREE from 'three';

const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  if (k < 0) c.lerp(new THREE.Color('#000000'), -k); else c.lerp(new THREE.Color('#ffffff'), k);
  return '#' + c.getHexString();
};
const lum = (hex) => { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };

// ---------------------------------------------------------------- regiões do atlas
const HEAD = { x: 0, y: 0, w: 640, h: 486 };
const FACE = { cx: 320, eyeY: 222, eyeDX: 34 };
const TORSO = { x0: 214, x1: 432, y0: 492, y1: 1004, neckY: 750 };
const ARMS = { y0: 652, y1: 822, x0: 26, x1: 616 };
const LEGS = { x0: 610, x1: 1024, y0: 765, y1: 1024, knee: 900 };

function hairPath(ctx, style) {
  ctx.beginPath();
  if (style === 'long' || style === 'ponytail' || style === 'bun') {
    // cobre a nuca toda e emoldura o rosto
    ctx.moveTo(0, 0); ctx.lineTo(640, 0);
    ctx.lineTo(640, style === 'long' ? 486 : 330);
    ctx.quadraticCurveTo(520, style === 'long' ? 470 : 300, 470, 236);
    ctx.lineTo(452, 205);
    ctx.bezierCurveTo(430, 150, 360, 120, 320, 128);
    ctx.bezierCurveTo(270, 135, 225, 165, 210, 205);
    ctx.lineTo(170, 236);
    ctx.quadraticCurveTo(120, style === 'long' ? 470 : 300, 0, style === 'long' ? 486 : 330);
  } else {
    ctx.moveTo(0, 0); ctx.lineTo(640, 0);
    ctx.lineTo(640, 310);
    ctx.quadraticCurveTo(540, 290, 478, 226);
    ctx.lineTo(452, 208);
    ctx.lineTo(420, 214);
    ctx.bezierCurveTo(412, 170, 380, 140, 320, 140);
    ctx.bezierCurveTo(262, 140, 228, 170, 220, 214);
    ctx.lineTo(188, 208);
    ctx.lineTo(162, 226);
    ctx.quadraticCurveTo(100, 290, 0, 310);
  }
  ctx.closePath();
}

function paintHead(ctx, cfg) {
  const skin = cfg.skin;
  ctx.fillStyle = skin;
  ctx.fillRect(HEAD.x, HEAD.y, HEAD.w, HEAD.h);
  // pescoço/queixo um pouco mais escuro
  const g = ctx.createLinearGradient(0, 300, 0, 486);
  g.addColorStop(0, shade(skin, -0.02)); g.addColorStop(1, shade(skin, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 300, 640, 186);
  ctx.fillStyle = shade(skin, -0.06);
  ctx.beginPath(); ctx.roundRect(232, 292, 176, 190, 60); ctx.fill();

  // cabelo
  const style = cfg.hairStyle;
  if (style !== 'bald') {
    ctx.save();
    hairPath(ctx, style);
    if (style === 'buzz') { ctx.globalAlpha = 0.55; }
    const hg = ctx.createLinearGradient(0, 0, 0, 330);
    hg.addColorStop(0, shade(cfg.hairColor, 0.08)); hg.addColorStop(1, shade(cfg.hairColor, -0.12));
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.clip();
    // mechas / brilho
    ctx.globalAlpha = style === 'buzz' ? 0.2 : 0.18;
    ctx.strokeStyle = shade(cfg.hairColor, 0.35);
    ctx.lineWidth = 6;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const x = 30 + i * 44;
      ctx.moveTo(x, 10); ctx.quadraticCurveTo(x + 20, 80, x - 6, 160);
      ctx.stroke();
    }
    ctx.restore();
    if (style === 'curly') {
      ctx.fillStyle = shade(cfg.hairColor, -0.05);
      for (let x = 196; x <= 444; x += 26) { ctx.beginPath(); ctx.arc(x, 150 + Math.abs(x - 320) * 0.32, 22, 0, Math.PI * 2); ctx.fill(); }
      for (let x = 0; x <= 640; x += 40) { if (x > 150 && x < 490) continue; ctx.beginPath(); ctx.arc(x, 300 - Math.min(Math.abs(x - 320) - 170, 150) * 0.2, 26, 0, Math.PI * 2); ctx.fill(); }
    }
    if (style === 'fringe' || style === 'bun' || style === 'ponytail') {
      ctx.fillStyle = shade(cfg.hairColor, -0.02);
      ctx.beginPath();
      ctx.moveTo(214, 205);
      ctx.bezierCurveTo(240, 130, 400, 120, 428, 205);
      ctx.lineTo(400, 186); ctx.lineTo(372, 198); ctx.lineTo(344, 178); ctx.lineTo(318, 196); ctx.lineTo(292, 176); ctx.lineTo(262, 194); ctx.lineTo(238, 182);
      ctx.closePath(); ctx.fill();
    }
  }

  // orelhas
  [190, 450].forEach((x) => {
    ctx.fillStyle = shade(skin, -0.04);
    ctx.beginPath(); ctx.ellipse(x, 240, 15, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(skin, -0.16);
    ctx.beginPath(); ctx.ellipse(x, 240, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
  });

  // rosto
  const { cx, eyeY, eyeDX } = FACE;
  const dark = '#1e1a1a';
  // bochechas
  ctx.fillStyle = 'rgba(255,120,120,0.22)';
  [cx - 62, cx + 62].forEach((x) => { ctx.beginPath(); ctx.ellipse(x, 262, 20, 12, 0, 0, Math.PI * 2); ctx.fill(); });
  // olhos
  [cx - eyeDX, cx + eyeDX].forEach((x, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, eyeY, 13, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(x + (i ? -1 : 1), eyeY + 1, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + 3, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill();
    if (cfg.face === 'lashes') {
      ctx.strokeStyle = dark; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      const s = i ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x + s * 11, eyeY - 9); ctx.lineTo(x + s * 19, eyeY - 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s * 6, eyeY - 13); ctx.lineTo(x + s * 11, eyeY - 21); ctx.stroke();
    }
  });
  // sobrancelhas
  ctx.strokeStyle = shade(cfg.hairStyle === 'bald' ? '#3a2a20' : cfg.hairColor, -0.2);
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    ctx.beginPath(); ctx.moveTo(cx + s * (eyeDX - 14), eyeY - 25); ctx.quadraticCurveTo(cx + s * eyeDX, eyeY - 33, cx + s * (eyeDX + 15), eyeY - 25); ctx.stroke();
  });
  // nariz
  ctx.fillStyle = shade(skin, -0.12);
  ctx.beginPath(); ctx.ellipse(cx, 248, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // barba / bigode / sardas
  if (cfg.face === 'beard' || cfg.face === 'stubble') {
    ctx.save();
    ctx.globalAlpha = cfg.face === 'stubble' ? 0.35 : 1;
    ctx.fillStyle = shade(cfg.hairColor, -0.1);
    ctx.beginPath();
    ctx.moveTo(214, 214);
    ctx.lineTo(236, 214);
    ctx.bezierCurveTo(250, 285, 292, 300, 320, 300);
    ctx.bezierCurveTo(348, 300, 390, 285, 404, 214);
    ctx.lineTo(426, 214);
    ctx.bezierCurveTo(424, 300, 380, 352, 320, 352);
    ctx.bezierCurveTo(260, 352, 216, 300, 214, 214);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, 300, 50, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (cfg.face === 'mustache' || cfg.face === 'beard') {
    ctx.fillStyle = shade(cfg.hairColor, -0.15);
    ctx.beginPath();
    ctx.moveTo(cx, 260);
    ctx.bezierCurveTo(cx + 20, 252, cx + 40, 258, cx + 42, 274);
    ctx.bezierCurveTo(cx + 28, 266, cx + 12, 268, cx, 268);
    ctx.bezierCurveTo(cx - 12, 268, cx - 28, 266, cx - 42, 274);
    ctx.bezierCurveTo(cx - 40, 258, cx - 20, 252, cx, 260);
    ctx.fill();
  }
  if (cfg.face === 'freckles') {
    ctx.fillStyle = shade(skin, -0.3);
    [[-70, 250], [-56, 258], [-74, 264], [-60, 244], [70, 250], [56, 258], [74, 264], [60, 244], [-8, 236], [8, 238]].forEach(([dx, y]) => { ctx.beginPath(); ctx.arc(cx + dx, y, 3, 0, Math.PI * 2); ctx.fill(); });
  }
  // boca
  ctx.strokeStyle = '#7a3434'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  if (cfg.face === 'calm') { ctx.moveTo(cx - 12, 282); ctx.lineTo(cx + 12, 282); } else { ctx.moveTo(cx - 17, 276); ctx.quadraticCurveTo(cx, 292, cx + 17, 276); }
  ctx.stroke();
}

function paintTop(ctx, cfg) {
  const c = cfg.shirt;
  const top = cfg.top;
  const longSleeve = ['hoodie', 'social', 'blazer', 'sweater'].includes(top);
  const body = top === 'blazer' ? c : c;
  // tronco
  const g = ctx.createLinearGradient(TORSO.x0, 0, TORSO.x1, 0);
  g.addColorStop(0, shade(body, -0.12)); g.addColorStop(0.15, body); g.addColorStop(0.85, body); g.addColorStop(1, shade(body, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(TORSO.x0 - 6, TORSO.y0, TORSO.x1 - TORSO.x0 + 12, TORSO.y1 - TORSO.y0);
  // mangas
  ctx.fillStyle = body;
  ctx.fillRect(ARMS.x0, ARMS.y0, ARMS.x1 - ARMS.x0, ARMS.y1 - ARMS.y0);
  ctx.fillStyle = shade(body, -0.08);
  ctx.fillRect(ARMS.x0, ARMS.y1 - 26, ARMS.x1 - ARMS.x0, 26);
  if (!longSleeve) {
    // antebraço com pele
    ctx.fillStyle = cfg.skin;
    ctx.fillRect(ARMS.x0 - 10, ARMS.y0 - 10, 150 - ARMS.x0, ARMS.y1 - ARMS.y0 + 20);
    ctx.fillRect(490, ARMS.y0 - 10, ARMS.x1 - 490 + 10, ARMS.y1 - ARMS.y0 + 20);
    ctx.fillStyle = shade(body, -0.15);
    ctx.fillRect(150, ARMS.y0, 10, ARMS.y1 - ARMS.y0);
    ctx.fillRect(480, ARMS.y0, 10, ARMS.y1 - ARMS.y0);
  } else {
    // punhos
    ctx.fillStyle = top === 'social' ? '#ffffff' : shade(body, -0.18);
    ctx.fillRect(ARMS.x0, ARMS.y0, 26, ARMS.y1 - ARMS.y0);
    ctx.fillRect(ARMS.x1 - 26, ARMS.y0, 26, ARMS.y1 - ARMS.y0);
  }
  const nx = 320, ny = TORSO.neckY;
  // golas e detalhes da frente (metade de baixo = frente)
  if (top === 'tshirt' || top === 'sweater') {
    ctx.strokeStyle = shade(body, -0.22); ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(nx, ny, 34, 0, Math.PI * 2); ctx.stroke();
    if (top === 'sweater') {
      ctx.fillStyle = shade(body, -0.18);
      for (let x = TORSO.x0; x < TORSO.x1; x += 14) { ctx.fillRect(x, TORSO.y1 - 50, 7, 30); ctx.fillRect(x, TORSO.y0 + 20, 7, 30); }
      ctx.fillStyle = shade(body, 0.12);
      ctx.fillRect(TORSO.x0, ny + 120, TORSO.x1 - TORSO.x0, 16);
      ctx.fillRect(TORSO.x0, ny - 136, TORSO.x1 - TORSO.x0, 16);
    }
  } else if (top === 'polo' || top === 'social') {
    ctx.fillStyle = shade(body, top === 'polo' ? -0.2 : -0.1);
    ctx.beginPath(); ctx.moveTo(nx - 46, ny - 10); ctx.lineTo(nx - 6, ny + 40); ctx.lineTo(nx - 54, ny + 52); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(nx + 46, ny - 10); ctx.lineTo(nx + 6, ny + 40); ctx.lineTo(nx + 54, ny + 52); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(body, -0.25); ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(nx, ny, 30, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = shade(body, -0.12);
    ctx.fillRect(nx - 9, ny + 30, 18, top === 'polo' ? 70 : TORSO.y1 - ny - 60);
    ctx.fillStyle = '#ffffff';
    const n = top === 'polo' ? 2 : 6;
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(nx, ny + 50 + i * 30, 5, 0, Math.PI * 2); ctx.fill(); }
  } else if (top === 'hoodie') {
    ctx.strokeStyle = shade(body, -0.25); ctx.lineWidth = 20;
    ctx.beginPath(); ctx.arc(nx, ny, 40, 0, Math.PI * 2); ctx.stroke();
    // capuz nas costas
    ctx.fillStyle = shade(body, -0.12);
    ctx.beginPath(); ctx.moveTo(nx - 80, ny - 30); ctx.quadraticCurveTo(nx, ny - 210, nx + 80, ny - 30); ctx.closePath(); ctx.fill();
    // bolso canguru + cordões
    ctx.fillStyle = shade(body, -0.1);
    ctx.beginPath(); ctx.roundRect(nx - 70, TORSO.y1 - 130, 140, 70, 18); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
    [-16, 16].forEach((dx) => { ctx.beginPath(); ctx.moveTo(nx + dx, ny + 36); ctx.lineTo(nx + dx * 1.2, ny + 110); ctx.stroke(); });
  } else if (top === 'blazer') {
    // camisa branca + gravata + lapelas
    ctx.fillStyle = '#f7f7f9';
    ctx.beginPath(); ctx.moveTo(nx - 60, ny - 4); ctx.lineTo(nx + 60, ny - 4); ctx.lineTo(nx, ny + 150); ctx.closePath(); ctx.fill();
    const tie = lum(c) > 0.55 ? '#c2263f' : (c === '#c2263f' ? '#1f2a44' : '#c2263f');
    ctx.fillStyle = tie;
    ctx.beginPath(); ctx.moveTo(nx - 11, ny + 20); ctx.lineTo(nx + 11, ny + 20); ctx.lineTo(nx + 16, ny + 120); ctx.lineTo(nx, ny + 140); ctx.lineTo(nx - 16, ny + 120); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(body, -0.22);
    ctx.beginPath(); ctx.moveTo(nx - 64, ny - 6); ctx.lineTo(nx - 8, ny + 152); ctx.lineTo(nx - 84, ny + 60); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(nx + 64, ny - 6); ctx.lineTo(nx + 8, ny + 152); ctx.lineTo(nx + 84, ny + 60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(body, -0.35);
    [ny + 185, ny + 215].forEach((y) => { ctx.beginPath(); ctx.arc(nx, y, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = shade(body, -0.15);
    ctx.fillRect(nx + 40, ny + 70, 40, 8);
  }
}

function paintLegs(ctx, cfg) {
  const p = cfg.pants;
  const lw = cfg.legwear;
  ctx.fillStyle = p;
  ctx.fillRect(LEGS.x0, LEGS.y0, LEGS.x1 - LEGS.x0, LEGS.y1 - LEGS.y0);
  // cintura nas pontas da "cruz" do tronco
  ctx.fillRect(TORSO.x0 - 6, TORSO.y0, TORSO.x1 - TORSO.x0 + 12, 30);
  ctx.fillRect(TORSO.x0 - 6, TORSO.y1 - 30, TORSO.x1 - TORSO.x0 + 12, 34);
  ctx.fillStyle = shade(p, -0.3);
  ctx.fillRect(TORSO.x0 - 6, TORSO.y0 + 18, TORSO.x1 - TORSO.x0 + 12, 10);
  ctx.fillRect(TORSO.x0 - 6, TORSO.y1 - 24, TORSO.x1 - TORSO.x0 + 12, 10);
  // dobras/sombras verticais
  [[636, 820], [826, 1008]].forEach(([a, b]) => {
    const g = ctx.createLinearGradient(a, 0, b, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g; ctx.fillRect(a, LEGS.y0, b - a, LEGS.y1 - LEGS.y0);
    if (lw === 'jeans') {
      ctx.strokeStyle = shade(p, 0.35); ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a + 18, LEGS.y0 + 30); ctx.lineTo(a + 18, LEGS.y1); ctx.moveTo(b - 18, LEGS.y0 + 30); ctx.lineTo(b - 18, LEGS.y1); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (lw === 'social') {
      ctx.strokeStyle = shade(p, -0.25); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo((a + b) / 2 - 40, LEGS.y0 + 40); ctx.lineTo((a + b) / 2 - 40, LEGS.y1); ctx.moveTo((a + b) / 2 + 40, LEGS.y0 + 40); ctx.lineTo((a + b) / 2 + 40, LEGS.y1); ctx.stroke();
    }
    if (lw === 'shorts' || lw === 'skirt') {
      ctx.fillStyle = cfg.skin;
      ctx.fillRect(a - 4, LEGS.knee - (lw === 'skirt' ? 10 : 0), b - a + 8, LEGS.y1 - LEGS.knee + 10);
      ctx.fillStyle = shade(p, -0.2);
      ctx.fillRect(a - 4, LEGS.knee - (lw === 'skirt' ? 18 : 8), b - a + 8, 8);
    }
  });
}

function paintShoes(ctx, cfg) {
  const s = cfg.shoes;
  const social = s === '#1f2229' || s === '#7a4a2a';
  ctx.fillStyle = social ? shade(s, -0.25) : '#e9e9ee';
  ctx.fillRect(640, 0, 384, 136);
  ctx.fillStyle = s;
  ctx.fillRect(640, 136, 184, 390);
  [150, 326].forEach((y) => {
    ctx.fillStyle = social ? shade(s, 0.12) : '#ffffff';
    ctx.beginPath(); ctx.roundRect(690, y + 10, 84, 60, 26); ctx.fill();
    if (!social) {
      ctx.beginPath(); ctx.roundRect(690, y + 100, 84, 50, 26); ctx.fill();
      ctx.fillStyle = shade(s, -0.25);
      for (let i = 0; i < 3; i++) ctx.fillRect(712, y + 60 + i * 12, 40, 5);
    }
  });
}

export function paintAvatarTexture(cfg, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size / 1024, size / 1024);
  // pele em tudo (mãos, braços, pescoço)
  ctx.fillStyle = cfg.skin;
  ctx.fillRect(0, 0, 1024, 1024);
  paintHead(ctx, cfg);
  paintTop(ctx, cfg);
  paintLegs(ctx, cfg);
  paintShoes(ctx, cfg);
  // mãos levemente mais claras
  ctx.fillStyle = shade(cfg.skin, 0.04);
  ctx.fillRect(824, 136, 200, 390);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
