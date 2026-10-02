// Malha WebRTC entre todos que estão online.
// - Data channel: posição em tempo real (~15 Hz), emotes e estado de mic/câmera.
// - Áudio/vídeo: transceivers fixos; liga/desliga o envio com replaceTrack (sem renegociar),
//   então quem está longe não recebe nada (privacidade + banda).
// - Sinalização (offer/answer) passa pelo /api sync, guardada no banco JSON.

const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class PeerMesh {
  constructor({ selfId, sid, ice, onData, onTrack, onChange }) {
    this.ice = Array.isArray(ice) && ice.length ? ice : ICE;
    this.selfId = selfId;
    this.sid = sid;
    this.onData = onData;
    this.onTrack = onTrack;
    this.onChange = onChange;
    this.peers = new Map();
    this.outbox = [];
    this.local = { audio: null, video: null };
  }

  get connecting() {
    for (const p of this.peers.values()) if (!p.open) return true;
    return false;
  }

  takeOutbox() { const o = this.outbox; this.outbox = []; return o; }

  signal(to, toSid, kind, payload) { this.outbox.push({ to, toSid, kind, payload }); }

  // Chamado a cada sync com a lista de quem está online (userId → sid).
  reconcile(online) {
    for (const [id, p] of this.peers) {
      const sid = online.get(id);
      if (!sid || sid !== p.sid) this.close(id);
    }
    const now = Date.now();
    for (const [id, sid] of online) {
      if (id === this.selfId || !sid) continue;
      let p = this.peers.get(id);
      if (p && !p.open && now - p.created > 15000) { this.close(id); p = null; }
      if (!p && this.selfId < id) this.offer(id, sid);
    }
  }

  create(id, sid) {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const p = { id, sid, pc, dc: null, open: false, created: Date.now(), audioTx: null, videoTx: null, sending: { audio: undefined, video: undefined }, remote: { audio: null, video: null } };
    this.peers.set(id, p);
    pc.ontrack = (e) => {
      const kind = e.track.kind;
      p.remote[kind] = new MediaStream([e.track]);
      this.onTrack?.(id, kind, p.remote[kind]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.close(id);
      this.onChange?.();
    };
    pc.ondatachannel = (e) => this.bindChannel(p, e.channel);
    return p;
  }

  bindChannel(p, dc) {
    p.dc = dc;
    dc.onopen = () => { p.open = true; this.onChange?.(); this.onData?.(p.id, { t: 'open' }); };
    dc.onclose = () => { const was = p.open; p.open = false; this.onChange?.(); if (was) this.onData?.(p.id, { t: 'close' }); };
    dc.onmessage = (e) => { try { this.onData?.(p.id, JSON.parse(e.data)); } catch { /* ignora */ } };
  }

  async waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return;
    await new Promise((resolve) => {
      const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
      const check = () => { if (pc.iceGatheringState === 'complete') done(); };
      const timer = setTimeout(done, 2500);
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  async offer(id, sid) {
    const p = this.create(id, sid);
    const { pc } = p;
    p.audioTx = pc.addTransceiver('audio', { direction: 'sendrecv' });
    p.videoTx = pc.addTransceiver('video', { direction: 'sendrecv' });
    this.bindChannel(p, pc.createDataChannel('dc'));
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await this.waitIce(pc);
      if (this.peers.get(id) !== p) return;
      this.signal(id, sid, 'offer', { type: 'offer', sdp: pc.localDescription.sdp });
    } catch (e) { console.warn('offer', e); this.close(id); }
  }

  async handleSignal(s) {
    if (s.kind === 'offer') {
      if (this.selfId < s.from) return; // só o id menor oferece
      this.close(s.from);
      const p = this.create(s.from, s.fromSid);
      const { pc } = p;
      try {
        await pc.setRemoteDescription(s.payload);
        for (const t of pc.getTransceivers()) {
          t.direction = 'sendrecv';
          const kind = t.receiver.track?.kind;
          if (kind === 'audio') p.audioTx = t;
          if (kind === 'video') p.videoTx = t;
        }
        await pc.setLocalDescription(await pc.createAnswer());
        await this.waitIce(pc);
        if (this.peers.get(s.from) !== p) return;
        this.signal(s.from, s.fromSid, 'answer', { type: 'answer', sdp: pc.localDescription.sdp });
      } catch (e) { console.warn('answer', e); this.close(s.from); }
    } else if (s.kind === 'answer') {
      const p = this.peers.get(s.from);
      if (!p || p.pc.signalingState !== 'have-local-offer') return;
      try { await p.pc.setRemoteDescription(s.payload); } catch (e) { console.warn('setAnswer', e); this.close(s.from); }
    } else if (s.kind === 'bye') {
      this.close(s.from);
    }
  }

  close(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    try { p.dc?.close(); } catch { /* */ }
    try { p.pc.close(); } catch { /* */ }
    this.onTrack?.(id, 'audio', null);
    this.onTrack?.(id, 'video', null);
    this.onChange?.();
  }

  closeAll() { [...this.peers.keys()].forEach((id) => this.close(id)); }

  send(id, msg) {
    const p = this.peers.get(id);
    if (p?.open && p.dc.readyState === 'open') { try { p.dc.send(JSON.stringify(msg)); } catch { /* */ } }
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const p of this.peers.values()) if (p.open && p.dc.readyState === 'open') { try { p.dc.send(data); } catch { /* */ } }
  }

  setLocalTracks({ audio, video }) {
    this.local = { audio: audio ?? null, video: video ?? null };
    for (const p of this.peers.values()) { p.sending = { audio: undefined, video: undefined }; }
  }

  // Liga/desliga o envio de mídia para um par específico.
  setSending(id, { audio, video }) {
    const p = this.peers.get(id);
    if (!p || !p.audioTx) return;
    const a = audio ? this.local.audio : null;
    const v = video ? this.local.video : null;
    if (p.sending.audio !== a) { p.sending.audio = a; p.audioTx.sender.replaceTrack(a).catch(() => {}); }
    if (p.sending.video !== v) { p.sending.video = v; p.videoTx?.sender.replaceTrack(v).catch(() => {}); }
  }

  isOpen(id) { return !!this.peers.get(id)?.open; }
}
