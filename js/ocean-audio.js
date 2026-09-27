/**
 * OceanAudio - Hệ thống âm thanh mô phỏng Đại Dương chuyên nghiệp 2 Giai Đoạn
 * Nâng cấp chất lượng âm thanh cao cấp:
 * - Giai đoạn 1 (Mặt biển & Bầu trời): Tiếng gió biển lộng gió, tiếng hải âu lảnh lót, tiếng sóng vỗ.
 * - Giai đoạn 2 (Dưới nước): Tiếng nước óc ách ùng ục (mô phỏng nhúng micro hydrophone xuống nước),
 *   và TIẾNG HÚ TẦN SỐ CAO CỦA CÁ VOI SÁT THỦ (ORCA) & CÁ HEO (thay thế tiếng trầm khó chịu bằng
 *   các âm thanh cao vút, ngân vang, thánh thót và trong trẻo của các loài thú biển).
 */
class OceanAudio {
    constructor() {
        this.ctx = null;
        this.isMuted = true;
        this.isPlaying = false;
        this.initialized = false;
        this.depthRatio = 0; // 0 = Mặt biển, 1 = Đáy biển sâu

        // Master Output
        this.masterGain = null;

        // Giai đoạn 1: Bầu trời & Gió biển, Hải âu
        this.stage1Gain = null;
        this.windGain = null;
        this.seagullTimer = null;

        // Giai đoạn 2: Dưới nước (Hydrophone mộc mạc, Cá voi sát thủ Orca & Cá heo)
        this.stage2Gain = null;
        this.hydrophoneGain = null;
        this.vocalizationTimer = null;
        this.bubbleTimer = null;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // 1. Master Gain Node
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // ==========================================
            // GIAI ĐOẠN 1: BẦU TRỜI & GIÓ BIỂN, HẢI ÂU
            // ==========================================
            this.stage1Gain = this.ctx.createGain();
            this.stage1Gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            this.stage1Gain.connect(this.masterGain);

            this._setupWindAndBreeze();
            this._startSeagullLoop();

            // ==========================================
            // GIAI ĐOẠN 2: DƯỚI NƯỚC (ÓC ÁCH & CÁ VOI SÁT THỦ / CÁ HEO)
            // ==========================================
            this.stage2Gain = this.ctx.createGain();
            this.stage2Gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
            this.stage2Gain.connect(this.masterGain);

            this._setupHydrophoneWater();
            this._startMarineMammalVocalizations();
            this._startUnderwaterBubbles();

            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API không khả dụng:', e);
        }
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 1: TIẾNG GIÓ BIỂN & SÓNG BỀ MẶT
    // ----------------------------------------------------
    _setupWindAndBreeze() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 3;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.025 * white)) / 1.025;
            lastOut = output[i];
            output[i] *= 3.2;
        }

        const windSource = this.ctx.createBufferSource();
        windSource.buffer = noiseBuffer;
        windSource.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
        windFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

        const windLFO = this.ctx.createOscillator();
        windLFO.frequency.setValueAtTime(0.18, this.ctx.currentTime);
        const windLFOGain = this.ctx.createGain();
        windLFOGain.gain.setValueAtTime(200, this.ctx.currentTime);

        windLFO.connect(windLFOGain);
        windLFOGain.connect(windFilter.frequency);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

        windSource.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.stage1Gain);

        windSource.start(0);
        windLFO.start(0);
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 1: TIẾNG HẢI ÂU KÊU LẢNH LÓT TRÊN BẦU TRỜI
    // ----------------------------------------------------
    playSeagullCall() {
        if (!this.ctx || this.isMuted || this.depthRatio > 0.3) return;
        try {
            const now = this.ctx.currentTime;
            const numCalls = 2 + Math.floor(Math.random() * 2);

            for (let i = 0; i < numCalls; i++) {
                const callStart = now + (i * 0.42);

                const osc = this.ctx.createOscillator();
                const mod = this.ctx.createOscillator();
                const modGain = this.ctx.createGain();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                osc.type = 'sine';
                const baseFreq = 1450 + Math.random() * 250;
                osc.frequency.setValueAtTime(baseFreq, callStart);
                osc.frequency.linearRampToValueAtTime(baseFreq + 600, callStart + 0.12);
                osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, callStart + 0.32);

                mod.type = 'sawtooth';
                mod.frequency.setValueAtTime(45, callStart);
                modGain.gain.setValueAtTime(80, callStart);
                mod.connect(modGain);
                modGain.connect(osc.frequency);

                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(baseFreq + 200, callStart);
                filter.Q.setValueAtTime(3.0, callStart);

                gain.gain.setValueAtTime(0, callStart);
                gain.gain.linearRampToValueAtTime(0.18, callStart + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, callStart + 0.35);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.stage1Gain);

                osc.start(callStart);
                mod.start(callStart);
                osc.stop(callStart + 0.36);
                mod.stop(callStart + 0.36);
            }
        } catch (e) {}
    }

    _startSeagullLoop() {
        const scheduleSeagull = () => {
            const delay = 4500 + Math.random() * 6500;
            this.seagullTimer = setTimeout(() => {
                if (!this.isMuted && this.depthRatio < 0.25) {
                    this.playSeagullCall();
                }
                scheduleSeagull();
            }, delay);
        };
        scheduleSeagull();
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 2: TIẾNG ÓC ÁCH CỦA NƯỚC (HYDROPHONE)
    // Âm thanh mộc mạc, ấm áp, thư thái mô phỏng micro nhúng vào nước
    // ----------------------------------------------------
    _setupHydrophoneWater() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2.5;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);

        let last = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (last + (0.02 * white)) / 1.02;
            last = data[i];
            data[i] *= 3.8;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        // Lowpass mộc mạc 220Hz ấm áp, êm dịu, không gây ù tai
        this.hydrophoneFilter = this.ctx.createBiquadFilter();
        this.hydrophoneFilter.type = 'lowpass';
        this.hydrophoneFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
        this.hydrophoneFilter.Q.setValueAtTime(3.2, this.ctx.currentTime);

        // LFO tạo nhịp điệu óc ách dịu dàng của nước biển sâu
        const sloshLFO = this.ctx.createOscillator();
        sloshLFO.frequency.setValueAtTime(0.32, this.ctx.currentTime);
        const sloshGain = this.ctx.createGain();
        sloshGain.gain.setValueAtTime(70, this.ctx.currentTime);
        sloshLFO.connect(sloshGain);
        sloshGain.connect(this.hydrophoneFilter.frequency);

        this.hydrophoneGain = this.ctx.createGain();
        this.hydrophoneGain.gain.setValueAtTime(0.48, this.ctx.currentTime);

        source.connect(this.hydrophoneFilter);
        this.hydrophoneFilter.connect(this.hydrophoneGain);
        this.hydrophoneGain.connect(this.stage2Gain);

        source.start(0);
        sloshLFO.start(0);
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 2: TIẾNG HÚ TẦN SỐ CAO CỦA CÁ VOI SÁT THỦ (ORCA)
    // Dành cho vùng biển 300m - 1000m: âm thanh cao vút, ngân nga du dương (1750Hz - 3200Hz)
    // ----------------------------------------------------
    playOrcaCall(force = false) {
        const meters = this.depthRatio * 3850;
        if (!this.ctx || this.isMuted || (!force && (meters < 260 || meters >= 1050))) return;
        try {
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const harmonic = this.ctx.createOscillator();
            const vibrato = this.ctx.createOscillator();
            const vibratoGain = this.ctx.createGain();

            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            const startFreq = 1750 + Math.random() * 250;
            const peakFreq = 2950 + Math.random() * 350;
            const endFreq = 2100 + Math.random() * 200;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.38);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 1.25);

            harmonic.type = 'triangle';
            harmonic.frequency.setValueAtTime(startFreq * 1.5, now);
            harmonic.frequency.exponentialRampToValueAtTime(peakFreq * 1.5, now + 0.38);
            harmonic.frequency.exponentialRampToValueAtTime(endFreq * 1.5, now + 1.25);

            vibrato.frequency.setValueAtTime(18, now);
            vibratoGain.gain.setValueAtTime(42, now);
            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2600, now);
            filter.Q.setValueAtTime(3.2, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.28, now + 0.12);
            gain.gain.setValueAtTime(0.25, now + 0.85);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            osc.connect(filter);
            harmonic.connect(filter);
            filter.connect(gain);
            gain.connect(this.stage2Gain);

            osc.start(now);
            harmonic.start(now);
            vibrato.start(now);

            osc.stop(now + 1.45);
            harmonic.stop(now + 1.45);
            vibrato.stop(now + 1.45);
        } catch (e) {}
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 2: TIẾNG CÁ HEO (DOLPHIN WHISTLE & ECHOLOCATION CLICKS)
    // Dành cho vùng biển 300m - 1000m: tiếng huýt sáo thanh cao vui tươi (2600Hz - 4800Hz)
    // ----------------------------------------------------
    playDolphinWhistle(force = false) {
        const meters = this.depthRatio * 3850;
        if (!this.ctx || this.isMuted || (!force && (meters < 260 || meters >= 1050))) return;
        try {
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            const startF = 2600 + Math.random() * 300;
            const peakF = 4200 + Math.random() * 500;
            const endF = 3100;

            osc.frequency.setValueAtTime(startF, now);
            osc.frequency.linearRampToValueAtTime(peakF, now + 0.16);
            osc.frequency.linearRampToValueAtTime(startF + 300, now + 0.32);
            osc.frequency.linearRampToValueAtTime(peakF + 150, now + 0.52);
            osc.frequency.exponentialRampToValueAtTime(endF, now + 0.72);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.24, now + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.76);

            osc.connect(gain);
            gain.connect(this.stage2Gain);

            osc.start(now);
            osc.stop(now + 0.8);

            const clickStart = now + 0.22;
            for (let c = 0; c < 8; c++) {
                const ct = clickStart + (c * 0.04);
                const clickOsc = this.ctx.createOscillator();
                const clickGain = this.ctx.createGain();

                clickOsc.type = 'sine';
                clickOsc.frequency.setValueAtTime(3600 + c * 110, ct);

                clickGain.gain.setValueAtTime(0.14, ct);
                clickGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.018);

                clickOsc.connect(clickGain);
                clickGain.connect(this.stage2Gain);

                clickOsc.start(ct);
                clickOsc.stop(ct + 0.022);
            }
        } catch (e) {}
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 3: TIẾNG CÁ VOI LƯNG GÙ VANG TỪ XA (DISTANT HUMPBACK WHALE SONG)
    // Dành cho độ sâu 1000m - 3850m: Tiếng hát trầm hùng, du dương u hoài
    // Vang vọng từ dặm dài đại dương với độ tán sắc âm học và tiếng vọng ngân xa
    // ----------------------------------------------------
    playDistantHumpbackSong(force = false) {
        const meters = this.depthRatio * 3850;
        if (!this.ctx || this.isMuted || (!force && meters < 950)) return;
        try {
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const harmonic = this.ctx.createOscillator();
            const vibrato = this.ctx.createOscillator();
            const vibratoGain = this.ctx.createGain();

            const distanceFilter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            // Mạng lưới tiếng vọng âm học từ xa (Distant Acoustic Reverb Echo)
            const delay = this.ctx.createDelay();
            delay.delayTime.setValueAtTime(0.38, now);
            const feedback = this.ctx.createGain();
            feedback.gain.setValueAtTime(0.42, now);
            const delayFilter = this.ctx.createBiquadFilter();
            delayFilter.type = 'lowpass';
            delayFilter.frequency.setValueAtTime(480, now);

            // Tần số hát du dương 340Hz - 620Hz
            const startFreq = 380 + Math.random() * 60;
            const peakFreq = 540 + Math.random() * 90;
            const dipFreq = 310 + Math.random() * 40;
            const endFreq = 420;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.8);
            osc.frequency.exponentialRampToValueAtTime(dipFreq, now + 1.8);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 2.7);

            harmonic.type = 'triangle';
            harmonic.frequency.setValueAtTime(startFreq * 2, now);
            harmonic.frequency.exponentialRampToValueAtTime(peakFreq * 2, now + 0.8);
            harmonic.frequency.exponentialRampToValueAtTime(dipFreq * 2, now + 1.8);
            harmonic.frequency.exponentialRampToValueAtTime(endFreq * 2, now + 2.7);

            // Rung chậm 4.8Hz tạo độ run rẩy u hoài mênh mang
            vibrato.frequency.setValueAtTime(4.8, now);
            vibratoGain.gain.setValueAtTime(16, now);
            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);

            // Bộ lọc nước sâu: Cắt tần số cao cực mạnh (<450Hz), tạo cảm giác âm thanh cách xa hàng kilomet qua biển sâu
            distanceFilter.type = 'lowpass';
            distanceFilter.frequency.setValueAtTime(450, now);
            distanceFilter.Q.setValueAtTime(2.6, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.28, now + 0.85); // Tiếng từ từ vang tới từ dặm xa
            gain.gain.setValueAtTime(0.24, now + 2.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8); // Ngân dài u uẩn tan dần

            osc.connect(distanceFilter);
            harmonic.connect(distanceFilter);
            distanceFilter.connect(gain);

            // Kết nối vào bộ vọng âm xa (SOFAR channel acoustic reverberation)
            gain.connect(this.stage2Gain);
            gain.connect(delay);
            delay.connect(delayFilter);
            delayFilter.connect(feedback);
            feedback.connect(delay);
            feedback.connect(this.stage2Gain);

            // Tầng vọng âm thứ 2 dội từ rãnh biển sâu (Abyssal secondary reflection)
            const delay2 = this.ctx.createDelay();
            delay2.delayTime.setValueAtTime(0.68, now);
            const feedback2 = this.ctx.createGain();
            feedback2.gain.setValueAtTime(0.25, now);
            delay.connect(delay2);
            delay2.connect(feedback2);
            feedback2.connect(this.stage2Gain);

            osc.start(now);
            harmonic.start(now);
            vibrato.start(now);

            osc.stop(now + 3.9);
            harmonic.stop(now + 3.9);
            vibrato.stop(now + 3.9);
        } catch (e) {}
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 3: TIẾNG CÁ NHÀ TÁNG PHÁT SÓNG ÂM VỰC THẲM (SPERM WHALE CODA CLICKS)
    // Dành cho độ sâu 1000m - 3850m: Chuỗi xung sonar đanh, rền, vọng xa trong bóng tối Mariana
    // ----------------------------------------------------
    playDistantSpermWhaleClicks(force = false) {
        const meters = this.depthRatio * 3850;
        if (!this.ctx || this.isMuted || (!force && meters < 950)) return;
        try {
            const now = this.ctx.currentTime;
            const numClicks = 6 + Math.floor(Math.random() * 3);

            for (let i = 0; i < numClicks; i++) {
                const clickTime = now + (i * 0.14);

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(580, clickTime);
                osc.frequency.exponentialRampToValueAtTime(180, clickTime + 0.045);

                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(520, clickTime);
                filter.Q.setValueAtTime(3.8, clickTime);

                gain.gain.setValueAtTime(0.24, clickTime);
                gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.06);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.stage2Gain);

                osc.start(clickTime);
                osc.stop(clickTime + 0.07);

                // Tiếng dội xa (Abyssal Canyon Echo) sau 220ms
                const echoTime = clickTime + 0.22;
                const echoOsc = this.ctx.createOscillator();
                const echoGain = this.ctx.createGain();
                const echoFilter = this.ctx.createBiquadFilter();

                echoOsc.type = 'sine';
                echoOsc.frequency.setValueAtTime(340, echoTime);

                echoFilter.type = 'lowpass';
                echoFilter.frequency.setValueAtTime(380, echoTime);

                echoGain.gain.setValueAtTime(0.09, echoTime);
                echoGain.gain.exponentialRampToValueAtTime(0.001, echoTime + 0.12);

                echoOsc.connect(echoFilter);
                echoFilter.connect(echoGain);
                echoGain.connect(this.stage2Gain);

                echoOsc.start(echoTime);
                echoOsc.stop(echoTime + 0.13);
            }
        } catch (e) {}
    }

    // Luân phiên phát tiếng theo đúng độ sâu:
    // - 300m - 1000m: Cá heo & Cá voi sát thủ Orca
    // - 1000m - 3850m: Cá voi lưng gù & Cá nhà táng ngân vang từ xa
    _startMarineMammalVocalizations() {
        const scheduleNext = () => {
            const delay = 6500 + Math.random() * 5500; // Mỗi 6.5 - 12s phát 1 lần
            this.vocalizationTimer = setTimeout(() => {
                if (!this.isMuted) {
                    const meters = this.depthRatio * 3850;
                    if (meters >= 280 && meters < 1000) {
                        // Vùng 300m - 1000m: Cá heo & Cá voi sát thủ
                        if (Math.random() > 0.45) {
                            this.playOrcaCall();
                        } else {
                            this.playDolphinWhistle();
                        }
                    } else if (meters >= 1000) {
                        // Vùng 1000m - Đáy biển: Cá voi lưng gù & Cá nhà táng ngân vang xa
                        if (Math.random() > 0.45) {
                            this.playDistantHumpbackSong();
                        } else {
                            this.playDistantSpermWhaleClicks();
                        }
                    }
                }
                scheduleNext();
            }, delay);
        };
        scheduleNext();
    }

    // Hàm gọi thử toàn bộ các âm thanh đại dương theo các tầng biển
    testMarineSound() {
        this.unmute();
        const meters = this.depthRatio * 3850;

        if (meters < 1000) {
            // Thử tiếng vùng 300m - 1000m: Orca + Dolphin
            this.playOrcaCall(true);
            setTimeout(() => {
                this.playDolphinWhistle(true);
            }, 1400);
        } else {
            // Thử tiếng vùng 1000m - Đáy biển: Cá voi lưng gù + Cá nhà táng
            this.playDistantHumpbackSong(true);
            setTimeout(() => {
                this.playDistantSpermWhaleClicks(true);
            }, 2600);
        }
    }

    _startUnderwaterBubbles() {
        const scheduleBubble = () => {
            const delay = 2000 + Math.random() * 3000;
            this.bubbleTimer = setTimeout(() => {
                if (!this.isMuted && this.depthRatio > 0.2) {
                    this.playBubble();
                }
                scheduleBubble();
            }, delay);
        };
        scheduleBubble();
    }

    playBubble() {
        if (!this.ctx || this.isMuted) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            const startFreq = 300 + Math.random() * 250;
            const endFreq = startFreq + 320 + Math.random() * 150;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.11);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.11, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

            osc.connect(gain);
            gain.connect(this.stage2Gain);

            osc.start(now);
            osc.stop(now + 0.14);
        } catch (e) {}
    }

    // Tiếng splash khi cá voi/cá heo rơi xuống biển
    playSplash() {
        if (!this.ctx || this.isMuted) return;
        try {
            const now = this.ctx.currentTime;
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.09));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(520, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.38);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            noise.start(now);
        } catch (e) {}
    }

    // ----------------------------------------------------
    // ĐIỀU KHIỂN CHUYỂN GIAI ĐOẠN THEO ĐỘ SÂU (CROSS-FADING)
    // - Mặt biển (0m - 300m): Tiếng sóng biển & gió giảm dần về 0, tiếng óc ách tăng dần
    // - Vùng 300m - 1000m: Chỉ nghe tiếng óc ách của nước + Cá voi sát thủ & Cá heo
    // - Vùng 1000m - 3850m: Tiếng óc ách + Cá voi lưng gù & Cá nhà táng ngân vang xa xăm
    // ----------------------------------------------------
    setDepth(depthRatio) {
        const prevMeters = this.depthRatio * 3850;
        this.depthRatio = Math.max(0, Math.min(1, depthRatio));
        const currMeters = this.depthRatio * 3850;

        // Kích hoạt âm thanh tức thì khi lần đầu vượt qua ranh giới các vùng
        if (!this.isMuted) {
            if (prevMeters < 300 && currMeters >= 300) {
                // Vừa lặn vào vùng 300m - 1000m: phát tiếng Orca/Cá heo
                this.playOrcaCall(true);
            } else if (prevMeters < 1000 && currMeters >= 1000) {
                // Vừa lặn vào vùng 1000m+: phát tiếng Cá voi lưng gù ngân vang từ xa
                this.playDistantHumpbackSong(true);
            }
        }

        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;

        // Tiếng sóng biển & gió trên mặt nước: giảm dần và tắt hẳn khi qua 300m
        if (currMeters <= 80) {
            this.stage1Gain.gain.setTargetAtTime(1.0, now, 0.2);
            this.stage2Gain.gain.setTargetAtTime(0.08, now, 0.2);
        } else if (currMeters < 300) {
            const t = (currMeters - 80) / 220; // 0 to 1
            this.stage1Gain.gain.setTargetAtTime(1.0 - t, now, 0.15);
            this.stage2Gain.gain.setTargetAtTime(t * 1.0, now, 0.15);
        } else {
            // Qua 300m: Tiếng sóng biển và gió tắt hoàn toàn, chỉ còn tiếng nước óc ách
            this.stage1Gain.gain.setTargetAtTime(0.0, now, 0.2);
            this.stage2Gain.gain.setTargetAtTime(1.0, now, 0.2);
        }

        // Càng xuống sâu, áp suất nước càng nén lại, tiếng nước óc ách càng trầm ấm, sâu lắng
        if (this.hydrophoneFilter) {
            const depthFreq = 230 - (this.depthRatio * 95); // 230Hz (mặt biển) -> 135Hz (vực Mariana)
            this.hydrophoneFilter.frequency.setTargetAtTime(depthFreq, now, 0.25);
        }
    }

    unmute() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.isMuted = false;
        this.isPlaying = true;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0.001, now);
        this.masterGain.gain.linearRampToValueAtTime(0.75, now + 0.5);
        this.setDepth(this.depthRatio);

        const meters = this.depthRatio * 3850;
        if (meters < 300) {
            setTimeout(() => this.playSeagullCall(), 300);
        } else if (meters < 1000) {
            setTimeout(() => this.playOrcaCall(true), 300);
        } else {
            setTimeout(() => this.playDistantHumpbackSong(true), 300);
        }
    }

    mute() {
        if (!this.ctx) return;
        this.isMuted = true;
        this.isPlaying = false;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.35);
    }

    toggle() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return !this.isMuted;
    }
}

// Khởi tạo global instance
window.oceanAudio = new OceanAudio();
