export class SoundManager {
    private ctx: AudioContext;
    private masterGain: GainNode;

    constructor() {
        // Inicjalizacja kontekstu audio (musi być stworzona, ale ruszy dopiero po interakcji usera)
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Głośność główna (żeby nie ogłuszyć gracza)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // 30% głośności
        this.masterGain.connect(this.ctx.destination);
    }

    // Wywoływane przy pierwszym kliknięciu, żeby odblokować audio w przeglądarce
    public async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // Dźwięk 1: SWAP (Wysoki świst "Whoosh")
    public playSwap() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        // Ustawienia brzmienia
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);

        // Obwiednia głośności (krótki fade-out)
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Dźwięk 2: MATCH / EXPLOSION (Szum "Crunch")
    public playExplosion() {
        const bufferSize = this.ctx.sampleRate * 0.3; // 0.3 sekundy
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Generowanie białego szumu
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filtr dolnoprzepustowy (żeby dźwięk był "basowy" a nie "syczący")
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        // Obwiednia głośności (uderzenie i zanikanie)
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

        noise.start();
    }

    // Dźwięk 3: POP (Przy zbieraniu punktów - wysokie "Ping")
    public playPop() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600 + Math.random() * 200, this.ctx.currentTime); // Losowa wysokość

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Dźwięk 4: BAD MOVE (Niski "Berrr")
    public playBadMove() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }
}