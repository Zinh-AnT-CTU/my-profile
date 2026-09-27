/**
 * OceanCanvas - Động cơ đồ họa Đại Dương Siêu Thực Điện Ảnh (Cinema-Grade 60FPS)
 * 1. Bầu trời & Sóng biển chuyển động sống động như Video 4K:
 *    - Hệ thống sóng biển Trochoidal / Gerstner Waves 4 tầng uốn lượn liên tục.
 *    - Ánh dương lấp lánh (Specular Sun Glints) nhảy múa trên đỉnh sóng.
 *    - Cá voi lưng gù & Cá heo siêu thực nhảy vọt lên không trung lộn mèo 360 độ kèm bọt nước.
 * 2. Ray-Tracing God Rays vật lý chân thực (Không còn là đèn sân khấu):
 *    - Rèm sáng khúc xạ quang học (Wave-refracted Caustic Curtains) uốn lượn hữu cơ theo nhịp sóng.
 *    - Hiệu ứng Tyndall: Vi sinh vật biển (Marine snow) phát sáng rực rỡ khi trôi qua chùm sáng.
 *    - Suy giảm quang học tự nhiên: Tắt dần và chìm hoàn toàn vào bóng tối sau 500m độ sâu.
 * 3. Đáy biển Mariana 3,850m hợp nhất hoàn hảo:
 *    - Sử dụng ocean-floor-shipwreck-abyss.png hòa tan 100% vào bóng tối thẳm sâu,
 *      không còn vết cắt hộp hay vùng sáng lệch tông.
 *    - Hào quang rương vàng và san hô dạ quang phát sáng sinh học huyền ảo.
 */

class OceanEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scrollDepth = 0; // 0 to 1
        this.smoothScroll = 0;
        this.mouse = { x: -1000, y: -1000, radius: 150 };
        this.time = 0;

        // Tải trước hình ảnh siêu thực
        this.images = {
            surfaceBg: new Image(),
            seabedAbyss: new Image(),
            whale: new Image(),
            dolphin: new Image()
        };
        this.images.surfaceBg.src = 'images/ocean-surface-bg.jpg';
        this.images.seabedAbyss.src = 'images/ocean-floor-shipwreck-abyss.png';
        this.images.whale.src = 'images/jumping-whale.png';
        this.images.dolphin.src = 'images/jumping-dolphin.png';

        this.initCanvasSize();
        this.initEntities();
        this.bindEvents();
        this.animate();
    }

    initCanvasSize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.initCanvasSize();
        });

        window.addEventListener('scroll', () => {
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            this.scrollDepth = docHeight > 0 ? Math.max(0, Math.min(1, window.scrollY / docHeight)) : 0;
            if (window.oceanAudio) {
                window.oceanAudio.setDepth(this.scrollDepth);
            }
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        });
    }

    initEntities() {
        // Trạng thái thời tiết & bầu trời: Nắng (sunny), Mưa (rainy), Buổi đêm (night), Thực tế (auto theo GMT+7)
        this.weather = {
            isRaining: false,
            mode: 'auto',
            rainIntensity: 0,
            skyPhase: 'day', // 'dawn', 'day', 'dusk', 'night'
            isNight: false,
            isSunset: false,
            isDawn: false,
            nightIntensity: 0,
            sunsetIntensity: 0
        };

        // 140 ngôi sao đêm lấp lánh (Night Stars)
        this.nightStars = [];
        for (let i = 0; i < 140; i++) {
            this.nightStars.push({
                x: Math.random(),
                y: Math.random() * 0.48, // Nửa trên bầu trời
                r: 0.6 + Math.random() * 1.5,
                baseAlpha: 0.35 + Math.random() * 0.65,
                twinkleSpeed: 1.2 + Math.random() * 2.8,
                phase: Math.random() * Math.PI * 2
            });
        }

        // 0. MÂY ĐA TẦNG SIÊU THỰC (Volumetric 3D Cumulus Clouds)
        this.clouds = [];
        const numClouds = 8;
        for (let i = 0; i < numClouds; i++) {
            this.clouds.push({
                x: (i / numClouds) * this.width + (Math.random() - 0.5) * 180,
                y: 20 + Math.random() * 110,
                scaleX: 220 + Math.random() * 200,
                scaleY: 45 + Math.random() * 32,
                speed: 0.025 + Math.random() * 0.035, // Di chuyển trôi êm ả
                opacity: 0.6 + Math.random() * 0.35,
                puffs: [
                    { dx: -55, dy: 8, r: 48 },
                    { dx: -24, dy: -12, r: 62 },
                    { dx: 12, dy: -8, r: 58 },
                    { dx: 48, dy: 6, r: 46 },
                    { dx: 75, dy: 14, r: 35 }
                ]
            });
        }

        // Khởi tạo hệ thống hạt mưa & vòng sóng mưa
        this.initRain();

        // 1. Hải âu bay lượn trên trời chân thực
        this.seagulls = [
            new RealisticSeagull(this.width * 0.22, 110, 0.85, 0),
            new RealisticSeagull(this.width * 0.65, 85, 1.1, 1.6),
            new RealisticSeagull(this.width * 0.82, 140, 0.7, 3.2),
            new RealisticSeagull(this.width * 0.42, 65, 0.6, 4.5)
        ];

        // 2. Tàu chở hàng to (Container Mega-Ships) chạy trên đường chân trời
        this.cargoShips = [
            {
                x: this.width * 0.75,
                speed: -0.11, // Chạy từ phải sang trái chậm rãi
                scale: 0.82,
                length: 270,
                hullColor: '#1e293b',
                keelColor: '#b91c1c',
                containers: [
                    { col: '#0284c7', count: 4, h: 14 },
                    { col: '#dc2626', count: 5, h: 17 },
                    { col: '#16a34a', count: 4, h: 15 },
                    { col: '#ea580c', count: 5, h: 18 },
                    { col: '#f1f5f9', count: 4, h: 13 },
                    { col: '#0284c7', count: 5, h: 16 }
                ]
            },
            {
                x: this.width * 0.12,
                speed: 0.065, // Chạy từ trái sang phải xa tít chân trời
                scale: 0.48,
                length: 210,
                hullColor: '#334155',
                keelColor: '#991b1b',
                containers: [
                    { col: '#ea580c', count: 4, h: 12 },
                    { col: '#0284c7', count: 4, h: 14 },
                    { col: '#16a34a', count: 3, h: 13 },
                    { col: '#f1f5f9', count: 4, h: 11 }
                ]
            }
        ];

        // 3. SINH VẬT BIỂN (Cá voi & Cá heo bơi lội dưới nước + Trồi nhảy vọt cột nước siêu thực)
        this.marineLife = new RealisticMarineLife(this);
        this.jumper = this.marineLife; // Alias hỗ trợ tương thích

        // 4. Volumetric Light Shafts (Tia sáng vật lý truyền THẲNG tuyệt đối, rải đều khắp mặt biển)
        this.lightCurtains = [];
        const numShafts = 32;
        for (let i = 0; i < numShafts; i++) {
            this.lightCurtains.push({
                xRatio: (i + 0.5) / numShafts + (Math.random() - 0.5) * (0.8 / numShafts),
                width: 45 + Math.random() * 65,
                baseAlpha: 0.14 + Math.random() * 0.16,
                speed: 0.7 + Math.random() * 0.6,
                phase: Math.random() * Math.PI * 2,
                slant: -0.06 + Math.random() * 0.03
            });
        }

        // 5. Đường nắng lấp lánh (Highway of Sun Glints / Diamond sparkles) rải khắp mặt biển
        this.sunGlints = [];
        for (let i = 0; i < 140; i++) {
            this.sunGlints.push({
                xRatio: Math.random(),
                offsetY: (Math.random() - 0.5) * 35,
                phase: Math.random() * Math.PI * 2,
                speed: 2.5 + Math.random() * 4.5,
                size: 1.6 + Math.random() * 3.4
            });
        }

        // 6. Tuyết biển (Marine snow) & Vi sinh vật phản quang Tyndall
        this.marineSnow = [];
        for (let i = 0; i < 110; i++) {
            this.marineSnow.push(new MarineSnowParticle(this.width, this.height));
        }

        // 7. Sứa dạ quang biển sâu siêu thực & dẻo mềm
        this.jellyfishList = [
            new RealisticJellyfish(0.18, 140, 0.85, '#00f2fe', '#bae6fd'),
            new RealisticJellyfish(0.82, 220, 0.95, '#c084fc', '#f3e8ff'),
            new RealisticJellyfish(0.48, 310, 0.72, '#38bdf8', '#e0f2fe'),
            new RealisticJellyfish(0.32, 180, 0.65, '#fde047', '#fef08a'),
            new RealisticJellyfish(0.68, 260, 0.78, '#34d399', '#a7f3d0')
        ];
    }

    // Khởi tạo hạt mưa & gợn sóng khi trời mưa
    initRain() {
        this.raindrops = [];
        const numDrops = 340;
        for (let i = 0; i < numDrops; i++) {
            this.raindrops.push({
                x: Math.random() * (this.width + 300) - 150,
                y: Math.random() * (this.height * 0.8) - 100,
                len: 16 + Math.random() * 18,
                speed: 18 + Math.random() * 10,
                vx: -2.8 - Math.random() * 1.5, // Mưa rơi xiên theo hướng gió biển
                alpha: 0.35 + Math.random() * 0.45
            });
        }
        this.rainRipples = [];
    }

    setWeather(config) {
        if (!config) return;
        this.weather.isRaining = !!config.isRaining;
        this.weather.mode = config.mode || 'auto';
        this.weather.skyPhase = config.skyPhase || 'day';
        this.weather.isNight = !!config.isNight;
        this.weather.isSunset = !!config.isSunset;
        this.weather.isDawn = !!config.isDawn;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.time += 0.016;

        this.smoothScroll += (this.scrollDepth - this.smoothScroll) * 0.085;

        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        const cameraY = this.smoothScroll * h * 4.2;
        const surfaceY = (h * 0.5) - cameraY;

        // Cập nhật cường độ chuyển đổi mưa, đêm và hoàng hôn/bình minh mượt mà
        const targetRain = this.weather.isRaining ? 1.0 : 0.0;
        this.weather.rainIntensity += (targetRain - this.weather.rainIntensity) * 0.035;

        const targetNight = (this.weather.isNight || this.weather.skyPhase === 'night') ? 1.0 : 0.0;
        this.weather.nightIntensity += (targetNight - this.weather.nightIntensity) * 0.035;

        const targetSunset = (this.weather.isSunset || this.weather.isDawn || this.weather.skyPhase === 'dusk' || this.weather.skyPhase === 'dawn') ? 1.0 : 0.0;
        this.weather.sunsetIntensity += (targetSunset - this.weather.sunsetIntensity) * 0.035;

        // Cập nhật sinh thái biển (Cá voi & Cá heo đang bơi & nhảy)
        this.marineLife.update(surfaceY);

        // ============================================
        // 0. CÁ VOI & CÁ HEO ĐANG BƠI DƯỚI NƯỚC (VẼ TRƯỚC LỚP SÓNG MẶT BIỂN)
        // ============================================
        if (surfaceY > -h * 0.9) {
            this.marineLife.drawUnderwater(ctx, surfaceY);
        }

        // ============================================
        // 1. SÓNG BIỂN & BẦU TRỜI CHUYỂN ĐỘNG SỐNG ĐỘNG
        // ============================================
        this.drawLivingSurface(surfaceY);

        // ============================================
        // 2. HẢI ÂU BAY LƯỢN TRÊN TRỜI (CHỈ KHI TRỜI KHÔNG MƯA TO)
        // ============================================
        if (surfaceY > -60 && this.weather.rainIntensity < 0.85) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - this.weather.rainIntensity * 0.8);
            this.seagulls.forEach(g => {
                g.update(this.time, w);
                g.draw(ctx);
            });
            ctx.restore();
        }

        // ============================================
        // 3. CÁ VOI / CÁ HEO TRỒI NHẢY LÊN KHÔNG TRUNG & CỘT NƯỚC VĂNG TỨ TUNG
        // ============================================
        this.marineLife.drawAirborneAndSplashes(ctx, surfaceY);

        // ============================================
        // 4. RAY-TRACING GOD RAYS VẬT LÝ HỮU CƠ
        // ============================================
        this.drawPhysicalVolumetricRays(surfaceY);

        // ============================================
        // 5. SỨA BIỂN DẠ QUANG DƯỚI NƯỚC SÂU (NGOI LÊN GẦN MẶT BIỂN RỒI LẶN XUỐNG)
        // ============================================
        this.jellyfishList.forEach(j => {
            j.update(this.time, surfaceY, w, h, cameraY);
            j.draw(ctx, surfaceY);
        });

        // ============================================
        // 6. TUYẾT BIỂN & VI SINH VẬT BẮT SÁNG (TYNDALL) - CHỈ Ở DƯỚI NƯỚC
        // ============================================
        this.marineSnow.forEach(p => {
            p.update(w, h, this.mouse, this.time, surfaceY);
            p.draw(ctx, this.smoothScroll, this.lightCurtains, surfaceY);
        });

        // ============================================
        // 7. ĐÁY BIỂN SÂU 3,850M: HỢP NHẤT HOÀN TOÀN VÀO BÓNG TỐI
        // ============================================
        this.drawSeamlessAbyssalSeabed(cameraY);
    }

    // ----------------------------------------------------
    // 1. KẾT XUẤT MẶT BIỂN, BẦU TRỜI & HIỆU ỨNG THỜI TIẾT (NẮNG/MƯA)
    // ----------------------------------------------------
    drawLivingSurface(surfaceY) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        if (surfaceY > -h) {
            ctx.save();
            const surfaceAlpha = Math.max(0, 1 - (this.smoothScroll * 3.5));
            ctx.globalAlpha = surfaceAlpha;

            // 1. Ảnh nền mặt biển siêu thực
            if (this.images.surfaceBg.complete && this.images.surfaceBg.naturalWidth > 0) {
                const img = this.images.surfaceBg;
                const imgRatio = img.naturalWidth / img.naturalHeight;
                const canvasRatio = w / h;
                let drawW = w;
                let drawH = h;
                if (canvasRatio > imgRatio) {
                    drawH = w / imgRatio;
                } else {
                    drawW = h * imgRatio;
                }
                const drawX = (w - drawW) / 2;
                const drawY = surfaceY - (drawH * 0.5);

                ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }

            // 2. HIỆU ỨNG BẦU TRỜI HOÀNG HÔN / BÌNH MINH (5h30-7h00 & 16h30-17h30)
            const sunsetT = this.weather.sunsetIntensity;
            if (sunsetT > 0.01) {
                ctx.save();
                const sunsetSky = ctx.createLinearGradient(0, 0, 0, Math.max(0, surfaceY));
                sunsetSky.addColorStop(0, `rgba(49, 16, 63, ${0.9 * sunsetT})`);
                sunsetSky.addColorStop(0.35, `rgba(180, 58, 85, ${0.85 * sunsetT})`);
                sunsetSky.addColorStop(0.7, `rgba(230, 110, 78, ${0.8 * sunsetT})`);
                sunsetSky.addColorStop(1, `rgba(251, 194, 82, ${0.75 * sunsetT})`);
                ctx.fillStyle = sunsetSky;
                ctx.fillRect(0, 0, w, Math.max(0, surfaceY));

                // Mặt trời ráng chiều / bình minh trên đường chân trời
                const sunX = w * 0.35;
                const sunY = surfaceY * 0.72;
                const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 70);
                sunGrad.addColorStop(0, `rgba(255, 247, 237, ${0.95 * sunsetT})`);
                sunGrad.addColorStop(0.25, `rgba(254, 215, 170, ${0.85 * sunsetT})`);
                sunGrad.addColorStop(0.6, `rgba(249, 115, 22, ${0.5 * sunsetT})`);
                sunGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = sunGrad;
                ctx.beginPath();
                ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 3. HIỆU ỨNG BẦU TRỜI ĐÊM HUYỀN ẢO & NGÀN SAO LẤP LÁNH (17h30 - 5h30)
            const nightT = this.weather.nightIntensity;
            if (nightT > 0.01) {
                ctx.save();
                const nightSky = ctx.createLinearGradient(0, 0, 0, Math.max(0, surfaceY));
                nightSky.addColorStop(0, `rgba(2, 6, 23, ${0.98 * nightT})`);
                nightSky.addColorStop(0.55, `rgba(15, 23, 42, ${0.95 * nightT})`);
                nightSky.addColorStop(1, `rgba(30, 41, 59, ${0.9 * nightT})`);
                ctx.fillStyle = nightSky;
                ctx.fillRect(0, 0, w, Math.max(0, surfaceY));

                // Vẽ 140 ngôi sao đêm lấp lánh (Twinkling Night Stars)
                this.nightStars.forEach(s => {
                    const starAlpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(this.time * s.twinkleSpeed + s.phase)) * nightT;
                    ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
                    ctx.beginPath();
                    ctx.arc(s.x * w, s.y * surfaceY, s.r, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Mặt trăng dạ quang tỏa sáng bàng bạc (Luminous Moon)
                const moonX = w * 0.76;
                const moonY = surfaceY * 0.28;
                // Vầng hào quang trăng
                const moonGlow = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 85);
                moonGlow.addColorStop(0, `rgba(224, 242, 254, ${0.75 * nightT})`);
                moonGlow.addColorStop(0.4, `rgba(56, 189, 248, ${0.35 * nightT})`);
                moonGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = moonGlow;
                ctx.beginPath();
                ctx.arc(moonX, moonY, 85, 0, Math.PI * 2);
                ctx.fill();

                // Đĩa trăng phát sáng bạc
                const moonCore = ctx.createRadialGradient(moonX - 5, moonY - 5, 2, moonX, moonY, 24);
                moonCore.addColorStop(0, `rgba(255, 255, 255, ${0.98 * nightT})`);
                moonCore.addColorStop(0.7, `rgba(240, 249, 255, ${0.92 * nightT})`);
                moonCore.addColorStop(1, `rgba(186, 230, 253, ${0.85 * nightT})`);
                ctx.fillStyle = moonCore;
                ctx.beginPath();
                ctx.arc(moonX, moonY, 24, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // Màn sắc thái bầu trời khi có mưa (Ambient Rain Dimming)
            const rainT = this.weather.rainIntensity;
            if (rainT > 0.02) {
                ctx.save();
                const rainSky = ctx.createLinearGradient(0, 0, 0, Math.max(0, surfaceY));
                rainSky.addColorStop(0, `rgba(15, 23, 42, ${0.65 * rainT})`);
                rainSky.addColorStop(0.7, `rgba(30, 41, 59, ${0.45 * rainT})`);
                rainSky.addColorStop(1, `rgba(51, 65, 85, ${0.25 * rainT})`);
                ctx.fillStyle = rainSky;
                ctx.fillRect(0, 0, w, Math.max(0, surfaceY));
                ctx.restore();
            }

            // 4. MÂY THỂ TÍCH 3D (Tự động biến đổi màu theo Nắng / Mưa / Hoàng Hôn / Đêm)
            this.clouds.forEach(c => {
                c.x += c.speed;
                if (c.x > w + c.scaleX + 90) {
                    c.x = -c.scaleX - 90;
                    c.y = 20 + Math.random() * 100;
                }
                const cloudCenterY = c.y + surfaceY * 0.22;

                ctx.save();
                const cAlpha = c.opacity * (1 - rainT * 0.15);

                c.puffs.forEach(p => {
                    const px = c.x + p.dx;
                    const py = cloudCenterY + p.dy;
                    const pr = p.r * 1.25;

                    const grad = ctx.createRadialGradient(px, py - 4, 3, px, py, pr);
                    if (nightT > 0.4) {
                        // Mây đêm: Ánh xanh đen sẫm với viền trăng bạc
                        grad.addColorStop(0, `rgba(51, 65, 85, ${cAlpha * 0.85 * nightT})`);
                        grad.addColorStop(0.6, `rgba(30, 41, 59, ${cAlpha * 0.7 * nightT})`);
                        grad.addColorStop(0.9, `rgba(15, 23, 42, ${cAlpha * 0.4 * nightT})`);
                        grad.addColorStop(1, 'transparent');
                    } else if (sunsetT > 0.3) {
                        // Mây hoàng hôn: Ánh hồng cam mật ong
                        grad.addColorStop(0, `rgba(254, 215, 170, ${cAlpha * 0.9 * sunsetT})`);
                        grad.addColorStop(0.55, `rgba(251, 146, 60, ${cAlpha * 0.75 * sunsetT})`);
                        grad.addColorStop(0.85, `rgba(190, 24, 93, ${cAlpha * 0.4 * sunsetT})`);
                        grad.addColorStop(1, 'transparent');
                    } else if (rainT < 0.1) {
                        // Nắng tươi sáng
                        grad.addColorStop(0, `rgba(255, 255, 255, ${cAlpha * 0.98})`);
                        grad.addColorStop(0.55, `rgba(240, 249, 255, ${cAlpha * 0.78})`);
                        grad.addColorStop(0.85, `rgba(224, 242, 254, ${cAlpha * 0.4})`);
                        grad.addColorStop(1, 'transparent');
                    } else {
                        // Chuyển sắc mây giông mọng nước
                        const r1 = Math.round(255 * (1 - rainT) + 100 * rainT);
                        const g1 = Math.round(255 * (1 - rainT) + 116 * rainT);
                        const b1 = Math.round(255 * (1 - rainT) + 139 * rainT);

                        const r2 = Math.round(240 * (1 - rainT) + 71 * rainT);
                        const g2 = Math.round(249 * (1 - rainT) + 85 * rainT);
                        const b2 = Math.round(255 * (1 - rainT) + 105 * rainT);

                        const r3 = Math.round(224 * (1 - rainT) + 30 * rainT);
                        const g3 = Math.round(242 * (1 - rainT) + 41 * rainT);
                        const b3 = Math.round(254 * (1 - rainT) + 59 * rainT);

                        grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${cAlpha * 0.98})`);
                        grad.addColorStop(0.6, `rgba(${r2}, ${g2}, ${b2}, ${cAlpha * 0.85})`);
                        grad.addColorStop(0.9, `rgba(${r3}, ${g3}, ${b3}, ${cAlpha * 0.5})`);
                        grad.addColorStop(1, 'transparent');
                    }

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.ellipse(px, py, pr, pr * 0.62, 0, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();
            });

            // 3. TÀU CHỞ HÀNG TO CHẠY TRÊN ĐƯỜNG CHÂN TRỜI
            this.drawCargoShips(ctx, surfaceY, w, h);

            // 4. HIỆU ỨNG HẠT MƯA RƠI & SÓNG MƯA TRÊN MẶT BIỂN (KHI CHẾ ĐỘ MƯA)
            if (rainT > 0.03) {
                this.drawRain(ctx, surfaceY, w, h, rainT);
            }

            // 5. MÔ PHỎNG SÓNG BIỂN GERSTNER & ĐƯỜNG NẮNG LẤP LÁNH KHẮP MẶT BIỂN
            this.drawGerstnerWaves(ctx, surfaceY, w, h);

            ctx.restore();
        }

        // Lớp dìm sâu vào bóng tối đại dương (CHỈ áp dụng khi lặn sâu > 4% độ sâu)
        const depth = this.smoothScroll;
        if (depth > 0.04) {
            const darkAlpha = Math.min(1, (depth - 0.04) / 0.32);
            const oceanBase = ctx.createLinearGradient(0, 0, 0, h);
            if (depth < 0.28) {
                oceanBase.addColorStop(0, `rgba(3, 20, 48, ${0.82 * darkAlpha})`);
                oceanBase.addColorStop(1, `rgba(1, 6, 18, ${0.98 * darkAlpha})`);
            } else if (depth < 0.58) {
                oceanBase.addColorStop(0, '#030a16');
                oceanBase.addColorStop(1, '#01040a');
            } else {
                oceanBase.addColorStop(0, '#02050c');
                oceanBase.addColorStop(1, '#000205');
            }

            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = oceanBase;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

    // ----------------------------------------------------
    // HIỆU ỨNG TRỜI MƯA TRÊN MẶT BIỂN (Hạt mưa xiên & gợn sóng tí tách)
    // ----------------------------------------------------
    drawRain(ctx, surfaceY, w, h, intensity) {
        if (!this.raindrops) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
        ctx.lineWidth = 1.3;

        // Cập nhật và vẽ các vệt mưa
        this.raindrops.forEach(d => {
            d.x += d.vx * (0.8 + intensity * 0.4);
            d.y += d.speed * (0.8 + intensity * 0.4);

            // Khi hạt mưa chạm vào mặt biển (surfaceY)
            if (d.y >= surfaceY + 2) {
                // Tạo gợn sóng mưa tí tách nở tròn trên mặt nước
                if (Math.random() < 0.35) {
                    this.rainRipples.push({
                        x: d.x,
                        y: surfaceY + (Math.random() - 0.5) * 6,
                        radius: 2,
                        maxRadius: 8 + Math.random() * 12,
                        alpha: 0.7 * intensity
                    });
                }
                // Reset hạt mưa lên trên
                d.y = -20 - Math.random() * 40;
                d.x = Math.random() * (w + 300) - 100;
            }

            // Chỉ vẽ những hạt mưa ở trên mặt nước
            if (d.y < surfaceY + 5) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x + d.vx * 1.8, d.y + d.len);
                ctx.stroke();
            }
        });

        // Vẽ các vòng sóng mưa tí tách trên mặt nước
        this.rainRipples.forEach(r => {
            r.radius += 0.85;
            r.alpha -= 0.035;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, r.alpha)})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, r.radius * 2.2, r.radius * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        this.rainRipples = this.rainRipples.filter(r => r.alpha > 0 && r.radius < r.maxRadius);

        ctx.restore();
    }

    // ----------------------------------------------------
    // TÀU CHỞ HÀNG TO (CONTAINER SHIPS) TRÊN ĐƯỜNG CHÂN TRỜI
    // ----------------------------------------------------
    drawCargoShips(ctx, surfaceY, w, h) {
        if (!this.cargoShips) return;

        this.cargoShips.forEach(ship => {
            ship.x += ship.speed;
            if (ship.speed < 0 && ship.x < -ship.length * ship.scale - 60) {
                ship.x = w + 100;
            } else if (ship.speed > 0 && ship.x > w + ship.length * ship.scale + 60) {
                ship.x = -ship.length * ship.scale - 100;
            }

            ctx.save();
            ctx.translate(ship.x, surfaceY - 5);
            ctx.scale(ship.scale, ship.scale);

            // 1. Vệt nước rẽ sóng (Wake & Bow wave)
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.beginPath();
            if (ship.speed < 0) {
                // Di chuyển sang trái: rẽ sóng bên trái, vệt nước kéo dài về bên phải
                ctx.ellipse(-ship.length * 0.48, 5, 14, 2.5, 0, 0, Math.PI * 2);
                ctx.ellipse(ship.length * 0.35, 6, 45, 3, 0, 0, Math.PI * 2);
            } else {
                // Di chuyển sang phải: rẽ sóng bên phải, vệt nước kéo dài về bên trái
                ctx.ellipse(ship.length * 0.48, 5, 14, 2.5, 0, 0, Math.PI * 2);
                ctx.ellipse(-ship.length * 0.35, 6, 45, 3, 0, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();

            // 2. Thân tàu container (Hull)
            const hullL = ship.length;
            const hullH = 16;

            // Đáy mớn nước màu đỏ (Red keel waterline)
            ctx.fillStyle = ship.keelColor;
            ctx.beginPath();
            ctx.roundRect(-hullL * 0.48, 1, hullL * 0.96, 6, [0, 0, 3, 3]);
            ctx.fill();

            // Mạn tàu màu xám/đen (Main hull)
            ctx.fillStyle = ship.hullColor;
            ctx.beginPath();
            ctx.moveTo(-hullL * 0.49, 1);
            ctx.lineTo(-hullL * 0.47, -hullH);
            ctx.lineTo(hullL * 0.45, -hullH);
            ctx.lineTo(hullL * 0.48, 1);
            ctx.closePath();
            ctx.fill();

            // Vạch sơn trắng nhận diện mạn tàu
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-hullL * 0.47, -hullH + 2);
            ctx.lineTo(hullL * 0.45, -hullH + 2);
            ctx.stroke();

            // 3. Các khối container nhiều màu sắc xếp tầng
            const containerStartX = -hullL * 0.42;
            const containerSlotW = 28;
            ship.containers.forEach((block, idx) => {
                const cx = containerStartX + idx * (containerSlotW + 4);
                if (cx > hullL * 0.28) return;

                ctx.fillStyle = block.col;
                // Khối container xếp cao
                ctx.fillRect(cx, -hullH - block.h, containerSlotW, block.h);

                // Khung viền lashing container
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(cx, -hullH - block.h, containerSlotW, block.h);

                // Vạch ngang từng tầng container
                for (let tier = 6; tier < block.h; tier += 6) {
                    ctx.beginPath();
                    ctx.moveTo(cx, -hullH - tier);
                    ctx.lineTo(cx + containerSlotW, -hullH - tier);
                    ctx.stroke();
                }
            });

            // 4. Tháp điều hành & Cầu tàu (Bridge & Superstructure) gần đuôi tàu
            const bridgeX = ship.speed < 0 ? hullL * 0.32 : -hullL * 0.38;
            const bridgeW = 32;
            const bridgeH = 34;

            // Khối nhà màu trắng
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(bridgeX, -hullH - bridgeH, bridgeW, bridgeH);

            // Dải cửa sổ buồng lái (Bridge navigation windows)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(bridgeX + 2, -hullH - bridgeH + 4, bridgeW - 4, 4);

            // Cột anten radar viễn thông
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bridgeX + bridgeW * 0.5, -hullH - bridgeH);
            ctx.lineTo(bridgeX + bridgeW * 0.5, -hullH - bridgeH - 12);
            ctx.moveTo(bridgeX + bridgeW * 0.3, -hullH - bridgeH - 8);
            ctx.lineTo(bridgeX + bridgeW * 0.7, -hullH - bridgeH - 8);
            ctx.stroke();

            // Ống khói tàu (Funnel)
            const funnelX = bridgeX + (ship.speed < 0 ? 20 : -10);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(funnelX, -hullH - bridgeH + 8, 8, 16);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(funnelX, -hullH - bridgeH + 6, 8, 2);

            // Khói mờ nhạt từ ống khói (Heat shimmer / faint smoke)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            const smokeShift = (ship.speed < 0 ? 1 : -1) * (Math.sin(this.time * 2) * 4 + 8);
            ctx.arc(funnelX + 4 + smokeShift, -hullH - bridgeH + 2, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    // Mô phỏng sóng biển nhè nhẹ và ánh nắng phản chiếu lung linh khắp mặt biển
    drawGerstnerWaves(ctx, surfaceY, w, h) {
        const rainT = this.weather ? this.weather.rainIntensity : 0;

        // 4 tầng sóng Trochoidal Gerstner kết hợp sóng mao dẫn (Capillary micro-ripples)
        const layers = [
            { amp: 4.8 + rainT * 1.5, freq: 0.0075, speed: 1.25, color: 'rgba(14, 165, 233, 0.42)', offset: -5 },
            { amp: 6.8 + rainT * 2.0, freq: 0.005, speed: 0.9, color: 'rgba(2, 132, 199, 0.58)', offset: 6 },
            { amp: 8.8 + rainT * 2.2, freq: 0.0035, speed: 0.65, color: 'rgba(3, 105, 161, 0.74)', offset: 18 },
            { amp: 11.5 + rainT * 2.5, freq: 0.0022, speed: 0.45, color: 'rgba(7, 89, 133, 0.88)', offset: 32 }
        ];

        layers.forEach((l, lIdx) => {
            ctx.beginPath();
            ctx.moveTo(0, h);

            for (let x = 0; x <= w; x += 8) {
                // Công thức sóng Trochoidal Gerstner đa hài hòa
                const wave1 = Math.sin(x * l.freq + this.time * l.speed) * l.amp;
                const wave2 = Math.cos(x * 0.0018 - this.time * 0.35) * (l.amp * 0.35);
                // Sóng mao dẫn lăn tăn siêu thực (Capillary micro-waves)
                const micro = Math.sin(x * 0.024 + this.time * 2.6) * 1.35;
                const y = surfaceY + l.offset + wave1 + wave2 + micro;

                if (x === 0) ctx.lineTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = l.color;
            ctx.fill();

            // Viền bọt sóng lấp lánh (Foam crests) ở tầng sóng trên cùng
            if (lIdx === 0) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.72 + rainT * 0.2})`;
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        });

        // ÁNH NẮNG PHẢN CHIẾU LUNG LINH KHẮP MẶT BIỂN (Chỉ hiển thị khi trời nắng / tạnh ráo)
        if (rainT < 0.75) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const sparkleFade = 1 - (rainT / 0.75);

            this.sunGlints.forEach(g => {
                const gx = g.xRatio * w;
                const waveY = surfaceY + Math.sin(gx * 0.006 + this.time * 0.9) * 8 + g.offsetY;
                const sparkle = Math.sin(this.time * g.speed + g.phase) * 0.5 + 0.5;

                if (sparkle > 0.2) {
                    const flareSize = g.size * (1 + sparkle * 1.6);
                    const grad = ctx.createRadialGradient(gx, waveY, 0, gx, waveY, flareSize * 2.5);
                    grad.addColorStop(0, `rgba(255, 255, 255, ${0.98 * sparkle * sparkleFade})`);
                    grad.addColorStop(0.3, `rgba(224, 242, 254, ${0.75 * sparkle * sparkleFade})`);
                    grad.addColorStop(0.7, `rgba(56, 189, 248, ${0.3 * sparkle * sparkleFade})`);
                    grad.addColorStop(1, 'transparent');

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(gx, waveY, flareSize * 2.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Ngôi sao 4 cánh lấp lánh (Diamond 4-point cross flare)
                    if (sparkle > 0.6) {
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * sparkle * sparkleFade})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(gx - flareSize * 2.8, waveY);
                        ctx.lineTo(gx + flareSize * 2.8, waveY);
                        ctx.moveTo(gx, waveY - flareSize * 2.8);
                        ctx.lineTo(gx, waveY + flareSize * 2.8);
                        ctx.stroke();
                    }
                }
            });
            ctx.restore();
        }
    }

    // ----------------------------------------------------
    // 2. RAY-TRACING GOD RAYS VẬT LÝ TRUYỀN THẲNG TUYỆT ĐỐI (KHÔNG UỐN LƯỢN, RẢI ĐỀU KHẮP MẶT BIỂN)
    // - Tuân thủ định luật quang học: Ánh sáng truyền theo đường thẳng trong môi trường đồng tính
    // - Rải đều khắp mặt biển (từ x = 0 đến x = width) thay vì tụ 1 chỗ
    // - Độ sáng lăng kính sóng (Wave-lens intensity modulation) thở nhịp nhàng tự nhiên
    // - Tắt dần hoàn toàn khi lặn sâu qua 600m
    // ----------------------------------------------------
    drawPhysicalVolumetricRays(surfaceY) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        const depth = this.smoothScroll;
        // Định luật suy giảm ánh sáng quang học tự nhiên
        const attenuation = Math.max(0, Math.exp(-depth * 4.6));
        if (attenuation <= 0.005) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const originY = Math.max(-30, surfaceY);

        // 1. HÀO QUANG MẶT TRỜI GIỮA TRƯA TỎA TRÊN TOÀN BỘ MẶT NƯỚC (High-Noon Surface Lens Glow)
        const surfaceGlow = ctx.createLinearGradient(0, originY, 0, originY + h * 0.45);
        surfaceGlow.addColorStop(0, `rgba(224, 242, 254, ${0.45 * attenuation})`);
        surfaceGlow.addColorStop(0.3, `rgba(56, 189, 248, ${0.2 * attenuation})`);
        surfaceGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = surfaceGlow;
        ctx.fillRect(0, originY, w, h * 0.45);

        // 2. CHÙM TIA SÁNG TRUYỀN THẲNG VẬT LÝ (STRAIGHT VOLUMETRIC SHAFTS) RẢI ĐỀU KHẮP MẶT BIỂN
        const beamLength = h * 1.45;
        this.lightCurtains.forEach((ray, idx) => {
            // Lăng kính sóng nước: sóng bề mặt điều biến cường độ sáng nhịp nhàng, góc tia vẫn THẲNG TUYỆT ĐỐI
            const waveModulation = Math.sin(this.time * ray.speed + ray.phase) * 0.35 + 0.65;
            const alpha = ray.baseAlpha * waveModulation * attenuation;
            if (alpha <= 0.008) return;

            // Tọa độ đỉnh tại mặt nước (rải đều khắp mặt biển từ 0 đến w)
            const topCenterX = ray.xRatio * w;
            const topW = ray.width * 0.75;

            // Tia sáng truyền thẳng tắp theo phương góc chiếu giữa trưa (hơi chếch đồng nhất)
            const slantOffset = beamLength * ray.slant;
            const bottomCenterX = topCenterX + slantOffset;
            const bottomW = ray.width * (1.35 + depth * 0.55);

            // TẦNG 1: VỎ HÀO QUANG MỀM (Soft Straight Volumetric Haze)
            ctx.beginPath();
            ctx.moveTo(topCenterX - topW * 1.5, originY);
            ctx.lineTo(bottomCenterX - bottomW * 1.5, originY + beamLength);
            ctx.lineTo(bottomCenterX + bottomW * 1.5, originY + beamLength);
            ctx.lineTo(topCenterX + topW * 1.5, originY);
            ctx.closePath();

            const hazeGrad = ctx.createLinearGradient(topCenterX, originY, bottomCenterX, originY + beamLength);
            hazeGrad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 0.45})`);
            hazeGrad.addColorStop(0.35, `rgba(14, 165, 233, ${alpha * 0.22})`);
            hazeGrad.addColorStop(0.75, `rgba(2, 132, 199, ${alpha * 0.08})`);
            hazeGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hazeGrad;
            ctx.fill();

            // TẦNG 2: LÕI TIA SÁNG CHIẾU THẲNG RỰC RỠ (Brilliant Straight Ray Core)
            ctx.beginPath();
            ctx.moveTo(topCenterX - topW * 0.55, originY);
            ctx.lineTo(bottomCenterX - bottomW * 0.55, originY + beamLength);
            ctx.lineTo(bottomCenterX + bottomW * 0.55, originY + beamLength);
            ctx.lineTo(topCenterX + topW * 0.55, originY);
            ctx.closePath();

            const coreGrad = ctx.createLinearGradient(topCenterX, originY, bottomCenterX, originY + beamLength);
            coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.75})`);
            coreGrad.addColorStop(0.2, `rgba(224, 242, 254, ${alpha * 1.15})`);
            coreGrad.addColorStop(0.55, `rgba(56, 189, 248, ${alpha * 0.45})`);
            coreGrad.addColorStop(0.85, `rgba(14, 116, 144, ${alpha * 0.1})`);
            coreGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = coreGrad;
            ctx.fill();
        });

        ctx.restore();
    }

    // ----------------------------------------------------
    // 3. ĐÁY BIỂN SÂU MARIANA 3,850M: HỢP NHẤT HOÀN TOÀN VÀO BÓNG TỐI
    // Tàu đắm chìm trong bóng tối abyssal tuyệt đối, chỉ rọi sáng bởi đèn thám hiểm ROV,
    // rương báu hoàng kim và san hô dạ quang - Không còn vùng sáng biển ban ngày lạc lõng
    // ----------------------------------------------------
    drawSeamlessAbyssalSeabed(cameraY) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        const floorProgress = Math.max(0, (this.smoothScroll - 0.7) / 0.3);
        if (floorProgress <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.min(1, floorProgress * 1.35);

        // Vẽ ảnh tàu đắm thám hiểm ROV trên nền đen tuyền (ocean-floor-shipwreck-abyss.png)
        if (this.images.seabedAbyss.complete && this.images.seabedAbyss.naturalWidth > 0) {
            const img = this.images.seabedAbyss;
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const canvasRatio = w / h;
            let drawW = w;
            let drawH = h;
            if (canvasRatio > imgRatio) {
                drawH = w / imgRatio;
            } else {
                drawW = h * imgRatio;
            }
            const drawX = (w - drawW) / 2;
            const drawY = h - (drawH * floorProgress);

            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // 1. Ánh vàng phát quang sinh học rực rỡ từ rương báu mở nắp
            const chestX = drawX + drawW * 0.66;
            const chestY = drawY + drawH * 0.78;
            const goldPulse = Math.sin(this.time * 3.2) * 0.2 + 0.8;

            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            const chestGlow = ctx.createRadialGradient(chestX, chestY, 5, chestX, chestY, 210);
            chestGlow.addColorStop(0, `rgba(253, 224, 71, ${0.65 * goldPulse})`);
            chestGlow.addColorStop(0.3, `rgba(245, 158, 11, ${0.35 * goldPulse})`);
            chestGlow.addColorStop(1, 'transparent');

            ctx.fillStyle = chestGlow;
            ctx.beginPath();
            ctx.arc(chestX, chestY, 210, 0, Math.PI * 2);
            ctx.fill();

            // Hạt bụi vàng bay lượn từ rương báu
            for (let p = 0; p < 8; p++) {
                const px = chestX + Math.sin(this.time * 2 + p) * 35;
                const py = chestY - ((this.time * 30 + p * 25) % 90);
                const pAlpha = 1 - (((this.time * 30 + p * 25) % 90) / 90);
                ctx.fillStyle = `rgba(254, 240, 138, ${pAlpha * 0.75})`;
                ctx.beginPath();
                ctx.arc(px, py, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Chùm sáng rọi thám hiểm của tàu lặn ROV (từ góc trên bên trái x = drawX + drawW * 0.18, y = drawY + drawH * 0.11)
            const rovX = drawX + drawW * 0.18;
            const rovY = drawY + drawH * 0.11;
            const rovPulse = Math.sin(this.time * 1.5) * 0.08 + 0.92;

            const rovBeam = ctx.createRadialGradient(rovX, rovY, 10, rovX + 160, rovY + 180, 360);
            rovBeam.addColorStop(0, `rgba(255, 255, 255, ${0.45 * rovPulse})`);
            rovBeam.addColorStop(0.2, `rgba(224, 242, 254, ${0.28 * rovPulse})`);
            rovBeam.addColorStop(0.6, `rgba(56, 189, 248, ${0.1 * rovPulse})`);
            rovBeam.addColorStop(1, 'transparent');

            ctx.fillStyle = rovBeam;
            ctx.beginPath();
            ctx.arc(rovX + 120, rovY + 140, 320, 0, Math.PI * 2);
            ctx.fill();

            // 3. San hô dạ quang phát ánh sáng xanh ngọc và tím neon trên thân tàu
            const coralCyan = ctx.createRadialGradient(drawX + drawW * 0.35, drawY + drawH * 0.58, 4, drawX + drawW * 0.35, drawY + drawH * 0.58, 140);
            coralCyan.addColorStop(0, 'rgba(0, 242, 254, 0.32)');
            coralCyan.addColorStop(1, 'transparent');
            ctx.fillStyle = coralCyan;
            ctx.beginPath();
            ctx.arc(drawX + drawW * 0.35, drawY + drawH * 0.58, 140, 0, Math.PI * 2);
            ctx.fill();

            const coralPurple = ctx.createRadialGradient(drawX + drawW * 0.44, drawY + drawH * 0.48, 4, drawX + drawW * 0.44, drawY + drawH * 0.48, 120);
            coralPurple.addColorStop(0, 'rgba(192, 132, 252, 0.28)');
            coralPurple.addColorStop(1, 'transparent');
            ctx.fillStyle = coralPurple;
            ctx.beginPath();
            ctx.arc(drawX + drawW * 0.44, drawY + drawH * 0.48, 120, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        ctx.restore();
    }
}

/**
 * Lớp Hải Âu Bay Lượn Chân Thực (Anatomical Shaded Seagulls with Dynamic Wing Flapping)
 * Tạo hình giải phẫu chi tiết: thân thuôn khí động học, lưng xám lông vũ, bụng trắng tuyết,
 * đầu mỏ vàng chấm đỏ đặc trưng, chóp cánh đen điểm đốm trắng,
 * đôi cánh 2 khớp gập vẫy chân thực theo chu kỳ lực nâng (downstroke) và thu cánh (upstroke) xen kẽ chao lượn (gliding)
 */
class RealisticSeagull {
    constructor(baseX, baseY, scale, timeOffset) {
        this.baseX = baseX;
        this.baseY = baseY;
        this.scale = scale * 1.4;
        this.timeOffset = timeOffset;
        this.radiusX = 190 + Math.random() * 120;
        this.radiusY = 38 + Math.random() * 26;
        this.speed = 0.42 + Math.random() * 0.22;
        this.x = baseX;
        this.y = baseY;
        this.facing = 1;
        this.tilt = 0;
    }

    update(time, maxW) {
        const t = time * this.speed + this.timeOffset;
        const prevX = this.x;
        const prevY = this.y;
        this.x = this.baseX + Math.cos(t) * this.radiusX;
        this.y = this.baseY + Math.sin(t * 1.5) * this.radiusY;

        const vx = this.x - prevX;
        const vy = this.y - prevY;
        this.facing = vx >= 0 ? 1 : -1;
        this.tilt = Math.atan2(vy, Math.abs(vx)) * 0.55;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale * this.facing, this.scale);
        ctx.rotate(this.tilt * this.facing);

        // Chu kỳ bay: vẫy cánh dồn lực 3.6s, sau đó khóa cánh chao lượn (dihedral glide) 2.8s
        const now = window.performance.now() * 0.005 + this.timeOffset;
        const isGliding = (now % 6.4) > 3.6;

        // Khớp vai (Shoulder flap) & Khớp cổ tay/đầu cánh (Wingtip flex with phase delay)
        const flapCycle = Math.sin(now * 3.6);
        const shoulderFlap = isGliding ? -5 : flapCycle * 18;
        const wingtipFlex = isGliding ? 3 : Math.sin(now * 3.6 - 0.75) * 24;

        // Nhấp nhô thân mình theo nhịp đập cánh (Lift recoil)
        const bodyBob = isGliding ? 0 : flapCycle * 2.2;

        // 1. Thân chim hải âu (Aerodynamic Shaded Fuselage)
        const bodyGrad = ctx.createLinearGradient(0, -6 + bodyBob, 0, 8 + bodyBob);
        bodyGrad.addColorStop(0, '#f1f5f9');
        bodyGrad.addColorStop(0.5, '#ffffff');
        bodyGrad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, bodyBob, 17, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lưng cánh phủ màu xám lông vũ (Slate Grey Mantle)
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2, -1.5 + bodyBob, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Đầu chim & Mỏ vàng chấm đỏ (Head & Beak)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(15, -1 + bodyBob, 5, 0, Math.PI * 2);
        ctx.fill();

        // Mỏ vàng nhọn
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(18, -2 + bodyBob);
        ctx.lineTo(26, bodyBob);
        ctx.lineTo(18, 2 + bodyBob);
        ctx.closePath();
        ctx.fill();

        // Đốm đỏ ở chóp mỏ dưới đặc trưng hải âu
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(22, 0.8 + bodyBob, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Mắt đen có viền vàng hổ phách
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(15, -1.8 + bodyBob, 1.1, 0, Math.PI * 2);
        ctx.fill();

        // 3. Đuôi chim xòe nhẹ điều hướng (Tail feathers)
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-15, -1 + bodyBob);
        ctx.lineTo(-26, -3.5 + bodyBob);
        ctx.lineTo(-28, bodyBob);
        ctx.lineTo(-26, 3.5 + bodyBob);
        ctx.lineTo(-15, 1 + bodyBob);
        ctx.closePath();
        ctx.fill();

        // 4. CÁNH XA (Left wing - back layer)
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-3, -1 + bodyBob);
        ctx.quadraticCurveTo(-14, shoulderFlap * 0.85 - 9 + bodyBob, -28, shoulderFlap + wingtipFlex - 12 + bodyBob);
        ctx.lineTo(-32, shoulderFlap + wingtipFlex - 15 + bodyBob);
        ctx.lineTo(-23, shoulderFlap * 0.85 - 4 + bodyBob);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 5. CÁNH GẦN (Right wing - front layer với khớp vai, khuỷu và lông chóp đen)
        ctx.save();
        const elbowX = -12;
        const elbowY = shoulderFlap - 7 + bodyBob;
        const tipX = -28;
        const tipY = shoulderFlap + wingtipFlex - 9 + bodyBob;

        // Bề mặt cánh xám tro
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(3, -2 + bodyBob);
        ctx.quadraticCurveTo(elbowX + 4, elbowY, tipX, tipY);
        ctx.quadraticCurveTo(elbowX - 2, elbowY + 7, -6, bodyBob);
        ctx.closePath();
        ctx.fill();

        // Rìa trước cánh màu trắng tuyết (White leading edge)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(3, -2 + bodyBob);
        ctx.quadraticCurveTo(elbowX + 4, elbowY, tipX, tipY);
        ctx.stroke();

        // Chóp cánh màu đen tuyền (Black primary wingtips)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(tipX + 9, tipY + (elbowY - tipY) * 0.32);
        ctx.lineTo(tipX - 6, tipY - 4);
        ctx.lineTo(tipX - 2, tipY + 4);
        ctx.closePath();
        ctx.fill();

        // Đốm trắng apical spot đặc trưng trên chóp cánh đen
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tipX + 1, tipY - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.restore();
    }
}

/**
 * Lớp Sinh Thái Biển Chân Thực (RealisticMarineLife)
 * - Cá voi lưng gù & Cá heo bơi lội mềm mại dưới nước ở tầng ánh sáng nông
 * - Lâu lâu chuyển hướng ngoi lên, lấy đà vọt xé toạc mặt biển nhảy lên không trung
 * - Khi đáp xuống biển:
 *   1. Tạo CỘT NƯỚC DÂNG CAO (Vertical water geyser / spouts) trắng xoá
 *   2. Các bọt nước & sương mù văng tứ tung hình cánh quạt rơi tự do theo trọng lực Newton
 *   3. DƯỚI MẶT BIỂN: Cú va chạm nén hàng chục bọt khí chìm sâu xuống nước, rồi lực đẩy
 *      Ác-si-mét nâng các bọt khí sủi tăm cuộn xoáy nổi dần lên mặt nước rồi vỡ tan!
 *   4. Cá lặn sâu xuống rồi lấy lại thăng bằng bơi tiếp tục dưới nước!
 */
class RealisticMarineLife {
    constructor(engine) {
        this.engine = engine;

        // 1. CÁ VOI LƯNG GÙ (Oai vệ, khổng lồ)
        this.whale = {
            type: 'whale',
            x: this.engine.width * 0.22,
            yOffset: 130, // Độ sâu bơi dưới mặt nước
            vx: 0.85,
            dir: 1, // 1: bơi sang phải, -1: bơi sang trái
            state: 'swimming', // 'swimming' | 'surfacing' | 'jumping' | 'plunging'
            swimPhase: 0,
            timer: 4.0, // Thời gian chuẩn bị nhảy lần đầu
            breathTimer: 3.5,
            jumpProgress: 0,
            startX: 0,
            jumpWidth: 0,
            apexHeight: 280,
            scale: 0.95
        };

        // 2. CÁ HEO TINH NGHỊCH (Bơi nhanh nhẹn, nhào lộn vui tươi)
        this.dolphin = {
            type: 'dolphin',
            x: this.engine.width * 0.75,
            yOffset: 80,
            vx: -1.45,
            dir: -1,
            state: 'swimming',
            swimPhase: 1.8,
            timer: 9.0, // Lệch pha với cá voi để luân phiên xuất hiện
            jumpProgress: 0,
            startX: 0,
            jumpWidth: 0,
            apexHeight: 185,
            scale: 0.82
        };

        // Danh sách hiệu ứng nước vật lý
        this.waterColumns = [];    // Cột nước dâng cao trắng xóa (Geysers)
        this.splashes = [];        // Hạt nước văng tứ tung trên không
        this.underwaterBubbles = []; // Bọt khí chìm sâu rồi nổi dần lên dưới mặt biển
        this.mistClouds = [];      // Màn sương nước mù mịt
        this.surfaceRipples = [];  // Sóng dội lan tỏa trên mặt nước
        this.breathBubbles = [];   // Bọt khí thở ra khi bơi dưới nước
    }

    // Cập nhật toàn bộ chuyển động sinh vật biển & vật lý nước
    update(surfaceY) {
        const creatures = [this.whale, this.dolphin];

        creatures.forEach(c => {
            c.swimPhase += 0.045;

            // 1. TRẠNG THÁI BƠI DƯỚI NƯỚC (SWIMMING)
            if (c.state === 'swimming') {
                c.x += c.vx;

                // Quay đầu khi bơi ra mép màn hình
                const margin = 180;
                if (c.vx > 0 && c.x > this.engine.width + margin) {
                    c.vx = -Math.abs(c.vx);
                    c.dir = -1;
                    c.x = this.engine.width + margin;
                } else if (c.vx < 0 && c.x < -margin) {
                    c.vx = Math.abs(c.vx);
                    c.dir = 1;
                    c.x = -margin;
                }

                // Nhả bọt khí thở thong thả khi bơi
                if (c.type === 'whale') {
                    c.breathTimer -= 0.016;
                    if (c.breathTimer <= 0) {
                        this.spawnBreathBubble(c.x, surfaceY + c.yOffset);
                        c.breathTimer = 4.0 + Math.random() * 3.5;
                    }
                }

                // Đếm ngược thời gian nhảy lên mặt nước
                c.timer -= 0.016;
                if (c.timer <= 0) {
                    // Chuyển sang lấy đà ngoi lên
                    c.state = 'surfacing';
                    c.surfacingProgress = 0;
                    c.surfaceStartX = c.x;
                }
            }

            // 2. TRẠNG THÁI LẤY ĐÀ NGOI LÊN (SURFACING)
            else if (c.state === 'surfacing') {
                c.surfacingProgress += 0.025;
                c.x += c.vx * 1.35;

                // Khi đầu cá chạm mặt biển (surfaceY) -> phóng vọt lên không trung!
                if (c.surfacingProgress >= 1.0) {
                    c.state = 'jumping';
                    c.jumpProgress = 0;
                    c.startX = c.x;
                    const dir = c.dir;
                    c.jumpWidth = (c.type === 'whale' ? (400 + Math.random() * 150) : (300 + Math.random() * 120)) * dir;

                    // Bọt nước xé sóng khi vọt lên
                    this.createBreachPlume(c.startX, surfaceY, c.type);
                    this.createSurfaceRipple(c.startX, surfaceY, c.type === 'whale' ? 1.0 : 0.65);
                }
            }

            // 3. TRẠNG THÁI BAY NHẢY TRÊN KHÔNG TRUNG (JUMPING)
            else if (c.state === 'jumping') {
                c.jumpProgress += (c.type === 'whale' ? 0.0092 : 0.0115);

                // Khi rơi chạm lại mặt nước (RE-ENTRY IMPACT)
                if (c.jumpProgress >= 0.94) {
                    const impactX = c.startX + c.jumpWidth;

                    // ============================================
                    // KÍCH HOẠT CÚ VA CHẠM ĐẠI DƯƠNG SIÊU THỰC:
                    // 1. Cột nước dâng cao ngất trời
                    // 2. Bọt trắng văng tứ tung
                    // 3. Dưới mặt biển: Bọt khí chìm sâu rồi nổi dần lên
                    // ============================================
                    this.createImpactPlume(impactX, surfaceY, c.type);
                    this.createSurfaceRipple(impactX, surfaceY, c.type === 'whale' ? 1.5 : 0.95);

                    if (window.oceanAudio) {
                        window.oceanAudio.playSplash();
                    }

                    // Chuyển sang trạng thái lặn xuống dưới nước
                    c.state = 'plunging';
                    c.plungeProgress = 0;
                    c.x = impactX;
                }
            }

            // 4. TRẠNG THÁI LẶN XUỐNG DƯỚI NƯỚC SAU KHI ĐÁP (PLUNGING)
            else if (c.state === 'plunging') {
                c.plungeProgress += 0.028;
                c.x += c.vx * 0.85;

                // Hoàn tất cú lặn -> trở lại bơi ngang thong thả dưới nước
                if (c.plungeProgress >= 1.0) {
                    c.state = 'swimming';
                    c.timer = (c.type === 'whale' ? 14 + Math.random() * 8 : 10 + Math.random() * 7);
                }
            }
        });

        // ============================================
        // CẬP NHẬT VẬT LÝ NƯỚC (CỘT NƯỚC, BỌT KHÍ, HẠT NƯỚC)
        // ============================================

        // 1. Cột nước dâng cao (Vertical Geysers)
        this.waterColumns.forEach(col => {
            if (col.phase === 'rising') {
                col.currentH += col.growSpeed;
                if (col.currentH >= col.maxH) {
                    col.currentH = col.maxH;
                    col.phase = 'falling';
                }
            } else {
                col.currentH -= col.decaySpeed;
                col.alpha -= 0.024;
            }
        });
        this.waterColumns = this.waterColumns.filter(c => c.alpha > 0 && c.currentH > 0);

        // 2. Hạt nước văng tứ tung (Airborne Parabolic Splashes)
        this.splashes.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.44; // Trọng lực Newton g
            s.vx *= 0.985; // Lực cản không khí
            s.alpha -= 0.018;

            if (s.y > surfaceY + 10) {
                s.alpha -= 0.08;
            }
        });
        this.splashes = this.splashes.filter(s => s.alpha > 0);

        // 3. DƯỚI MẶT BIỂN: Bọt khí chìm sâu xuống rồi nổi dần lên (Underwater Cavitation Bubbles)
        this.underwaterBubbles.forEach(b => {
            if (b.state === 'plunging') {
                // Đang bị đẩy sâu xuống dưới mặt nước theo quán tính va chạm
                b.y += b.vy;
                b.x += b.vx;
                b.vy *= 0.88; // Sức cản của nước phanh lại rất nhanh
                b.vx *= 0.92;

                if (b.vy <= 0.4 || b.y >= b.maxDepth) {
                    b.state = 'rising'; // Chuyển sang nổi lên
                }
            } else {
                // Lực đẩy Ác-si-mét kéo bọt khí từ từ nổi ngược lên mặt nước
                b.y += b.buoyancy;
                b.x += Math.sin(this.engine.time * b.wobbleSpeed + b.wobbleOffset) * 0.75;
                b.alpha -= 0.009;

                // Khi chạm mặt nước (surfaceY) thì vỡ tan
                if (b.y <= surfaceY + 4) {
                    b.alpha -= 0.12;
                }
            }
        });
        this.underwaterBubbles = this.underwaterBubbles.filter(b => b.alpha > 0 && b.y > surfaceY);

        // 4. Bọt khí thở khi bơi thong thả
        this.breathBubbles.forEach(b => {
            b.y -= b.speed;
            b.x += Math.sin(this.engine.time * 2 + b.offset) * 0.5;
            b.alpha -= 0.012;
        });
        this.breathBubbles = this.breathBubbles.filter(b => b.alpha > 0 && b.y > surfaceY);

        // 5. Màn sương nước mù mịt (Water Mist)
        this.mistClouds.forEach(m => {
            m.radius += m.expandSpeed;
            m.y -= 0.35;
            m.alpha -= 0.015;
        });
        this.mistClouds = this.mistClouds.filter(m => m.alpha > 0);

        // 6. Sóng dội trên mặt nước (Concentric foam ripples)
        this.surfaceRipples.forEach(r => {
            r.radius += r.speed;
            r.alpha -= 0.014;
        });
        this.surfaceRipples = this.surfaceRipples.filter(r => r.alpha > 0);
    }

    spawnBreathBubble(x, y) {
        for (let i = 0; i < 4; i++) {
            this.breathBubbles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y - 5 - Math.random() * 15,
                radius: 1.2 + Math.random() * 2.4,
                speed: 0.6 + Math.random() * 0.8,
                offset: Math.random() * Math.PI * 2,
                alpha: 0.75
            });
        }
    }

    // Bọt nước xé sóng khi vừa ngoi lên
    createBreachPlume(x, surfaceY, type) {
        const isWhale = type === 'whale';
        const count = isWhale ? 65 : 40;
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;
            const speed = (isWhale ? 6 : 4) + Math.random() * (isWhale ? 10 : 7);
            this.splashes.push({
                x: x + (Math.random() - 0.5) * (isWhale ? 55 : 30),
                y: surfaceY + 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.8 + Math.random() * (isWhale ? 4.2 : 2.8),
                alpha: 0.95
            });
        }
    }

    // Cú va chạm dội nước siêu thực khi cá rơi xuống biển
    createImpactPlume(x, surfaceY, type) {
        const isWhale = type === 'whale';

        // 1. CỘT NƯỚC DÂNG CAO TRẮNG XÓA (Vertical Water Geysers)
        const numColumns = isWhale ? 7 : 5;
        for (let c = 0; c < numColumns; c++) {
            const colOffset = (c - (numColumns - 1) / 2) * (isWhale ? 24 : 15);
            const maxHeight = (isWhale ? 210 : 135) + Math.random() * (isWhale ? 80 : 50);
            this.waterColumns.push({
                x: x + colOffset + (Math.random() - 0.5) * 12,
                baseY: surfaceY + 2,
                currentH: 15,
                maxH: maxHeight,
                width: (isWhale ? 32 : 18) + Math.random() * 12,
                growSpeed: 22 + Math.random() * 14,
                decaySpeed: 9 + Math.random() * 6,
                phase: 'rising',
                alpha: 0.96
            });
        }

        // 2. BỌT TRẮNG VĂNG TỨ TUNG (Airborne Parabolic Splashes)
        const numDrops = isWhale ? 160 : 95;
        for (let i = 0; i < numDrops; i++) {
            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
            const speed = (isWhale ? 6.5 : 4.5) + Math.random() * (isWhale ? 18 : 12);
            this.splashes.push({
                x: x + (Math.random() - 0.5) * (isWhale ? 85 : 50),
                y: surfaceY - 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.8 + Math.random() * (isWhale ? 5.6 : 3.8),
                alpha: 1.0
            });
        }

        // 3. DƯỚI MẶT BIỂN: Bọt khí chìm sâu xuống rồi nổi dần lên (Underwater Cavitation Cloud)
        const numBubbles = isWhale ? 80 : 45;
        for (let b = 0; b < numBubbles; b++) {
            const spreadX = (Math.random() - 0.5) * (isWhale ? 110 : 65);
            const initialDownSpeed = 4.0 + Math.random() * (isWhale ? 8.5 : 5.5);
            this.underwaterBubbles.push({
                x: x + spreadX,
                y: surfaceY + 5 + Math.random() * 20,
                vx: (Math.random() - 0.5) * 3.5,
                vy: initialDownSpeed, // Bị nén tống xuống dưới
                maxDepth: surfaceY + 50 + Math.random() * (isWhale ? 180 : 100),
                radius: 1.6 + Math.random() * (isWhale ? 5.0 : 3.2),
                state: 'plunging',
                buoyancy: -0.65 - Math.random() * 1.35, // Lực đẩy nổi lên
                wobbleSpeed: 3 + Math.random() * 4,
                wobbleOffset: Math.random() * Math.PI * 2,
                alpha: 0.95
            });
        }

        // 4. Màn sương nước mù mịt bốc lên
        for (let m = 0; m < (isWhale ? 6 : 4); m++) {
            this.mistClouds.push({
                x: x + (Math.random() - 0.5) * (isWhale ? 80 : 45),
                y: surfaceY - 15 - Math.random() * 30,
                radius: (isWhale ? 35 : 22) + Math.random() * 30,
                expandSpeed: 1.1 + Math.random() * 0.8,
                alpha: 0.75
            });
        }
    }

    createSurfaceRipple(x, surfaceY, scale = 1.0) {
        this.surfaceRipples.push({ x: x, y: surfaceY, radius: 20 * scale, speed: 3.5 * scale, alpha: 0.95, width: 3.5 });
        this.surfaceRipples.push({ x: x, y: surfaceY, radius: 48 * scale, speed: 2.6 * scale, alpha: 0.8, width: 2.5 });
        this.surfaceRipples.push({ x: x, y: surfaceY, radius: 85 * scale, speed: 1.8 * scale, alpha: 0.6, width: 1.8 });
        this.surfaceRipples.push({ x: x, y: surfaceY, radius: 125 * scale, speed: 1.3 * scale, alpha: 0.4, width: 1.4 });
    }

    // ============================================
    // VẼ DƯỚI NƯỚC: Cá bơi lặn & Bọt khí dưới biển (Vẽ trước lớp sóng biển)
    // ============================================
    drawUnderwater(ctx, surfaceY) {
        // 1. Vẽ bọt khí thở khi bơi
        this.breathBubbles.forEach(b => {
            ctx.save();
            ctx.fillStyle = `rgba(224, 242, 254, ${b.alpha * 0.75})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha * 0.9})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });

        // 2. DƯỚI MẶT BIỂN: Vẽ đám bọt khí va chạm chìm sâu rồi nổi dần lên
        this.underwaterBubbles.forEach(b => {
            ctx.save();
            // Lõi bọt khí óng ánh màu ngọc trai
            const grad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0.5, b.x, b.y, b.radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${b.alpha * 0.95})`);
            grad.addColorStop(0.5, `rgba(186, 230, 253, ${b.alpha * 0.7})`);
            grad.addColorStop(1, `rgba(56, 189, 248, ${b.alpha * 0.3})`);

            ctx.fillStyle = grad;
            ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha * 0.85})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });

        // 3. Vẽ Cá Voi & Cá Heo bơi dưới nước (Trạng thái swimming, surfacing, plunging)
        const creatures = [this.whale, this.dolphin];
        creatures.forEach(c => {
            if (c.state === 'jumping') return; // Lúc nhảy lên không trung sẽ vẽ ở hàm drawAirborneAndSplashes

            let drawX = c.x;
            let drawY = surfaceY + c.yOffset;
            let angle = (c.dir > 0 ? 1 : -1) * Math.sin(c.swimPhase) * 0.08;

            if (c.state === 'swimming') {
                drawY += Math.sin(c.swimPhase) * 12;
            } else if (c.state === 'surfacing') {
                // Chúc đầu hướng lên mặt biển
                const surfProgress = c.surfacingProgress || 0;
                drawY = surfaceY + c.yOffset * (1 - surfProgress);
                angle = (c.dir > 0 ? -0.42 : 0.42);
            } else if (c.state === 'plunging') {
                // Chúc đầu lặn sâu xuống rồi uốn ngang
                const plungeProgress = c.plungeProgress || 0;
                drawY = surfaceY + (c.yOffset * plungeProgress);
                angle = (c.dir > 0 ? 0.38 * (1 - plungeProgress) : -0.38 * (1 - plungeProgress));
            }

            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(angle);
            ctx.scale(c.dir > 0 ? -1 : 1, 1);

            const img = c.type === 'whale' ? this.engine.images.whale : this.engine.images.dolphin;
            if (img.complete && img.naturalWidth > 0) {
                // Hòa trộn vào làn nước xanh ngọc sâu thẳm
                ctx.save();
                ctx.globalAlpha = 0.72; // Độ trong suốt dưới nước chân thực
                ctx.filter = 'drop-shadow(0 15px 30px rgba(2, 44, 94, 0.85))';

                const drawW = c.type === 'whale' ? Math.min(this.engine.width * 0.48, 640) : 250;
                const drawH = drawW * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            }

            ctx.restore();
        });
    }

    // ============================================
    // VẼ TRÊN MẶT NƯỚC & KHÔNG TRUNG:
    // Cột nước dâng cao, bọt trắng văng tung tóe, sương mù & cú nhảy oai vệ
    // ============================================
    drawAirborneAndSplashes(ctx, surfaceY) {
        // 1. Màn sương nước bốc lên từ cú va chạm
        this.mistClouds.forEach(m => {
            ctx.save();
            const mistGrad = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.radius);
            mistGrad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha * 0.85})`);
            mistGrad.addColorStop(0.5, `rgba(240, 249, 255, ${m.alpha * 0.45})`);
            mistGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = mistGrad;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 2. Các vòng sóng bọt trắng loang dội trên mặt nước
        this.surfaceRipples.forEach(r => {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha * 0.95})`;
            ctx.lineWidth = r.width || 2;
            ctx.beginPath();
            ctx.ellipse(r.x, surfaceY, r.radius * 2.5, r.radius * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha * 0.45})`;
            ctx.lineWidth = (r.width || 2) + 2.5;
            ctx.beginPath();
            ctx.ellipse(r.x, surfaceY, r.radius * 2.5 + 2, r.radius * 0.55 + 1.2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        // 3. CỘT NƯỚC DÂNG CAO TRẮNG XÓA (Vertical Water Geysers)
        this.waterColumns.forEach(col => {
            ctx.save();
            const colH = col.currentH;
            const topY = col.baseY - colH;

            // Gradient cột nước dâng cao: Lõi trắng tuyết, chân cột nở rộng
            const geyserGrad = ctx.createLinearGradient(col.x, topY, col.x, col.baseY);
            geyserGrad.addColorStop(0, `rgba(255, 255, 255, ${col.alpha * 0.98})`);
            geyserGrad.addColorStop(0.3, `rgba(240, 249, 255, ${col.alpha * 0.9})`);
            geyserGrad.addColorStop(0.7, `rgba(186, 230, 253, ${col.alpha * 0.75})`);
            geyserGrad.addColorStop(1, `rgba(255, 255, 255, ${col.alpha * 0.95})`);

            ctx.fillStyle = geyserGrad;
            ctx.beginPath();
            // Thân cột nước nở rộng dần ở chân và vọt nhọn ở đỉnh
            ctx.moveTo(col.x - col.width * 0.35, topY + 8);
            ctx.lineTo(col.x + col.width * 0.35, topY + 8);
            ctx.lineTo(col.x + col.width * 0.75, col.baseY);
            ctx.lineTo(col.x - col.width * 0.75, col.baseY);
            ctx.closePath();
            ctx.fill();

            // Đỉnh cột nước vỡ bung thành chùm bọt xốp nở tròn
            const capRadius = col.width * 0.65;
            const capGrad = ctx.createRadialGradient(col.x, topY + 4, 1, col.x, topY + 4, capRadius);
            capGrad.addColorStop(0, `rgba(255, 255, 255, ${col.alpha})`);
            capGrad.addColorStop(0.6, `rgba(224, 242, 254, ${col.alpha * 0.85})`);
            capGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = capGrad;
            ctx.beginPath();
            ctx.arc(col.x, topY + 4, capRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // 4. Các hạt bọt trắng văng tứ tung (Airborne Parabolic Splashes)
        this.splashes.forEach(s => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.alpha);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 5. Vẽ Cá Voi & Cá Heo khi đang bay nhảy trên không trung (State: jumping)
        const creatures = [this.whale, this.dolphin];
        creatures.forEach(c => {
            if (c.state !== 'jumping') return;

            const p = c.jumpProgress;
            const currX = c.startX + c.jumpWidth * p;
            const currY = surfaceY - (4 * c.apexHeight * p * (1 - p));

            const dir = c.jumpWidth >= 0 ? 1 : -1;
            // Quỹ đạo uốn cong tự nhiên: Ngửa lên -> Ngang đỉnh -> Lao chúc đầu xuống
            const angle = (dir > 0) ? (-0.62 + p * 1.4) : (0.62 - p * 1.4);

            ctx.save();
            ctx.translate(currX, currY);
            ctx.rotate(angle);
            ctx.scale(dir > 0 ? -1 : 1, 1);

            const img = c.type === 'whale' ? this.engine.images.whale : this.engine.images.dolphin;
            if (img.complete && img.naturalWidth > 0) {
                ctx.globalCompositeOperation = 'source-over';
                const drawW = c.type === 'whale' ? Math.min(this.engine.width * 0.54, 720) : 280;
                const drawH = drawW * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            }

            ctx.restore();
        });
    }

    // Hàm draw tương thích ngược cho mã cũ
    draw(ctx, surfaceY) {
        this.drawAirborneAndSplashes(ctx, surfaceY);
    }
}

// Giữ lại alias RealisticJumper để không làm gãy mã phụ thuộc
class RealisticJumper extends RealisticMarineLife {}


/**
 * Lớp Tuyết Biển (Marine Snow) & Vi sinh vật phản quang Tyndall Effect
 * HOÀN TOÀN KHÔNG XUẤT HIỆN TRÊN MẶT BIỂN/BẦU TRỜI (xoá sạch bọt trên mặt biển)
 */
class MarineSnowParticle {
    constructor(w, h) {
        this.reset(w, h, true);
    }

    reset(w, h, randomY = false) {
        this.x = Math.random() * w;
        this.y = randomY ? (h * 0.45 + Math.random() * h * 0.55) : h + 15;
        this.radius = 1 + Math.random() * 2.8;
        this.speed = 0.35 + Math.random() * 1.0;
        this.swaySpeed = 0.8 + Math.random() * 1.4;
        this.swayOffset = Math.random() * Math.PI * 2;
        this.baseAlpha = 0.2 + Math.random() * 0.4;
    }

    update(w, h, mouse, time, surfaceY) {
        this.y -= this.speed;
        this.x += Math.sin(time * this.swaySpeed + this.swayOffset) * 0.65;

        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius && dist > 0) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x += (dx / dist) * force * 5.5;
            this.y += (dy / dist) * force * 5.5;
        }

        // Bọt khí & tuyết biển TUYỆT ĐỐI KHÔNG bay lên mặt biển/bầu trời
        if (this.y < surfaceY + 25) {
            this.reset(w, h);
        }
    }

    draw(ctx, scrollDepth, curtains, surfaceY) {
        // Không vẽ bất kỳ bọt khí nào nếu nằm trên mặt nước
        if (this.y < surfaceY + 25) return;

        let inRay = false;
        if (scrollDepth < 0.38) {
            const normX = this.x / ctx.canvas.width;
            for (let c of curtains) {
                if (Math.abs(normX - c.xRatio) < 0.04) {
                    inRay = true;
                    break;
                }
            }
        }

        const alpha = inRay ? Math.min(1, this.baseAlpha * 2.2) : this.baseAlpha;
        const radius = inRay ? this.radius * 1.4 : this.radius;

        ctx.save();
        ctx.fillStyle = inRay ? `rgba(224, 242, 254, ${alpha})` : `rgba(56, 189, 248, ${alpha * 0.45})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Lớp Sứa Biển Dạ Quang
 */
/**
 * Lớp Sứa Biển Dạ Quang Siêu Thực (Hyper-Realistic Bioluminescent Jellyfish)
 * - Thân chuông trong suốt đa lớp bằng đường cong Bezier mềm mại (thay thế elip cứng nhắc).
 * - Chu kỳ co bóp động cơ phản lực thủy động học: thu hẹp mép vòm tạo lực đẩy phụt nước,
 *   rồi từ từ giãn nở bè tròn mềm mại.
 * - 4 dải lụa miệng (oral arms) dài mềm như lụa chiffon uốn lượn theo chuỗi động học.
 * - Các sợi xúc tu tơ mỏng manh như tơ nhện rủ dài theo dòng nước.
 * - CƠ CHẾ GIỚI HẠN MẶT NƯỚC: Khi bơi ngoi lên gần sát mặt biển (cách mặt nước ~80px),
 *   sứa tự động uốn cong thân quay đầu chúc xuống 180 độ và co bóp lặn sâu trở lại,
 *   tuyệt đối không bao giờ bay lên trời!
 */
class RealisticJellyfish {
    constructor(xRatio, depthOffset, scale, color, secondaryColor) {
        this.xRatio = xRatio; // Vị trí theo tỉ lệ ngang (0 to 1)
        this.scale = scale;
        this.color = color;
        this.secondaryColor = secondaryColor || '#ffffff';
        this.phase = Math.random() * Math.PI * 2;
        this.pulseRate = 1.4 + Math.random() * 0.7;

        // Trạng thái bơi: 'rising' (ngoi lên) hoặc 'diving' (lặn xuống)
        this.state = Math.random() > 0.5 ? 'rising' : 'diving';
        this.angle = this.state === 'rising' ? 0 : Math.PI;
        this.targetAngle = this.angle;

        this.x = 0;
        this.y = 0;
        this.currentDepth = depthOffset; // Khoảng cách so với surfaceY

        // Giới hạn mặt nước an toàn:
        // Đỉnh cao nhất: surfaceY + minDepth (tuyệt đối không vượt qua mặt nước)
        // Độ sâu tối đa: surfaceY + maxDepth (vùng nước sâu)
        this.minDepth = 75 + Math.random() * 35;
        this.maxDepth = 450 + Math.random() * 260;

        // 4 dải lụa miệng rủ mềm (Oral Arms) với 9 đốt động học
        this.oralArms = [];
        for (let a = 0; a < 4; a++) {
            const arm = [];
            const numSegments = 9;
            for (let s = 0; s < numSegments; s++) {
                arm.push({ x: 0, y: s * 10 });
            }
            this.oralArms.push(arm);
        }

        // 10 sợi xúc tu tơ li ti rủ dài (Marginal Tentacles)
        this.numTentacles = 10;
        this.tentacles = [];
        for (let t = 0; t < this.numTentacles; t++) {
            const tentacle = [];
            const numSeg = 12;
            for (let s = 0; s < numSeg; s++) {
                tentacle.push({ x: 0, y: s * 7.5 });
            }
            this.tentacles.push(tentacle);
        }
    }

    update(time, surfaceY, width, height, cameraY) {
        this.phase += 0.026 * this.pulseRate;

        // Xung lực phụt nước đẩy cơ thể di chuyển
        const strokeSine = Math.sin(this.phase);
        const thrust = Math.pow(Math.max(0, strokeSine), 2.2) * 1.6;

        // Tự động điều chỉnh ngoi lên / lặn xuống
        if (this.state === 'rising') {
            this.currentDepth -= 0.45 + thrust * 0.75;
            this.targetAngle = Math.sin(time * 0.7 + this.phase) * 0.15; // Hướng lên, lắc lư nhẹ

            // KHI NGOI LÊN GẦN SÁT MẶT NƯỚC (surfaceY + minDepth)
            if (this.currentDepth <= this.minDepth) {
                // QUAY ĐẦU LẶN XUỐNG DƯỚI LÒNG BIỂN
                this.state = 'diving';
            }
        } else {
            // Đang bơi lặn sâu xuống
            this.currentDepth += 0.4 + thrust * 0.7;
            this.targetAngle = Math.PI + Math.sin(time * 0.7 + this.phase) * 0.15; // Hướng chúc xuống

            // KHI XUỐNG VÙNG SÂU (surfaceY + maxDepth)
            if (this.currentDepth >= this.maxDepth) {
                // QUAY ĐẦU NGOI LÊN TRỞ LẠI
                this.state = 'rising';
            }
        }

        // Xoay góc bơi mượt mà mềm mại (như sinh vật chuyển hướng trong nước)
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        this.angle += angleDiff * 0.045;

        // Tọa độ thực tế: Luôn luôn nằm DƯỚI mặt biển
        this.y = surfaceY + this.currentDepth;
        this.x = this.xRatio * width + Math.sin(time * 0.5 + this.phase) * 35;

        // Cập nhật động học chuỗi dẻo mềm cho 4 dải lụa miệng
        this.oralArms.forEach((arm, aIdx) => {
            const armAngleOffset = (aIdx - 1.5) * 0.28;
            let prevX = 0;
            let prevY = 12;

            arm.forEach((seg, sIdx) => {
                const waveOffset = Math.sin(this.phase - sIdx * 0.42 + aIdx * 1.2) * (3.5 + sIdx * 1.8);
                const driftX = Math.cos(time * 1.1 + sIdx * 0.3) * (2 + sIdx * 1.1);

                seg.x = prevX + waveOffset * 0.6 + driftX + (armAngleOffset * sIdx * 3.5);
                seg.y = prevY + (7 + sIdx * 1.1) * (1 - thrust * 0.12);

                prevX = seg.x;
                prevY = seg.y;
            });
        });

        // Cập nhật các sợi xúc tu tơ li ti
        this.tentacles.forEach((tent, tIdx) => {
            const spreadX = ((tIdx / (this.numTentacles - 1)) - 0.5) * 55;
            let prevX = spreadX;
            let prevY = 10;

            tent.forEach((seg, sIdx) => {
                const wave = Math.sin(this.phase - sIdx * 0.35 + tIdx) * (2.8 + sIdx * 1.4);
                seg.x = prevX + wave * 0.5;
                seg.y = prevY + 6.2 + sIdx * 0.75;
                prevX = seg.x;
                prevY = seg.y;
            });
        });
    }

    draw(ctx, surfaceY) {
        // Tuyệt đối không vẽ nếu nằm ngoài vùng nước hoặc ngoài khung nhìn
        if (this.y < surfaceY + 25 || this.y > ctx.canvas.height + 250) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.scale, this.scale);

        const pulse = Math.sin(this.phase); // -1 đến 1
        // Pha co bóp (pulse > 0): chuông thon hẹp, sâu hơn
        // Pha giãn nở (pulse < 0): chuông mở rộng hình vòm mềm
        const bellW = 46 * (1 - pulse * 0.22);
        const bellH = 36 * (1 + pulse * 0.24);
        const rimFlare = Math.cos(this.phase) * 5.5;

        // ============================================
        // 1. VẼ CÁC SỢI XÚC TU TƠ LI TI TRONG SUỐT (TENTACLES)
        // ============================================
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, 0.22)`;
        ctx.lineWidth = 0.8;
        this.tentacles.forEach(tent => {
            ctx.beginPath();
            ctx.moveTo(tent[0].x, tent[0].y);
            for (let i = 1; i < tent.length; i++) {
                ctx.lineTo(tent[i].x, tent[i].y);
            }
            ctx.stroke();
        });
        ctx.restore();

        // ============================================
        // 2. VẼ 4 DẢI LỤA MIỆNG DẺO MỀM BỒNG BỀNH (FLOWING ORAL ARMS)
        // ============================================
        this.oralArms.forEach((arm, aIdx) => {
            ctx.save();
            const armGrad = ctx.createLinearGradient(0, 10, 0, 95);
            armGrad.addColorStop(0, `rgba(255, 255, 255, 0.65)`);
            armGrad.addColorStop(0.3, `${this.color}55`);
            armGrad.addColorStop(0.7, `${this.color}25`);
            armGrad.addColorStop(1, 'transparent');

            ctx.strokeStyle = armGrad;
            ctx.lineWidth = 2.4 - aIdx * 0.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(0, 10);
            for (let i = 0; i < arm.length - 1; i++) {
                const xc = (arm[i].x + arm[i + 1].x) / 2;
                const yc = (arm[i].y + arm[i + 1].y) / 2;
                ctx.quadraticCurveTo(arm[i].x, arm[i].y, xc, yc);
            }
            ctx.stroke();

            // Rìa diềm xếp nếp (frilled ruffles) của lụa miệng
            ctx.strokeStyle = `rgba(255, 255, 255, 0.32)`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            for (let i = 1; i < arm.length; i += 2) {
                const ruffleW = Math.sin(this.phase * 2 + i) * 5.5;
                ctx.ellipse(arm[i].x, arm[i].y, Math.abs(ruffleW), 2.8, 0, 0, Math.PI * 2);
            }
            ctx.stroke();

            ctx.restore();
        });

        // ============================================
        // 3. VÒM CHUÔNG TRONG SUỐT PHA LÊ HỮU CƠ (TRANSLUCENT BELL)
        // ============================================
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 24;

        // Vòm chuông chính (Bezier spline uốn lượn dẻo mềm)
        const leftLipX = -bellW;
        const leftLipY = 8 + rimFlare;
        const rightLipX = bellW;
        const rightLipY = 8 + rimFlare;
        const apexY = -bellH;

        ctx.beginPath();
        ctx.moveTo(leftLipX, leftLipY);
        ctx.bezierCurveTo(-bellW * 0.85, apexY * 0.75, -bellW * 0.45, apexY, 0, apexY);
        ctx.bezierCurveTo(bellW * 0.45, apexY, bellW * 0.85, apexY * 0.75, rightLipX, rightLipY);

        // Mép đáy chuông uốn lượn vồng vào trong mềm mại
        ctx.bezierCurveTo(bellW * 0.5, 2 - pulse * 4, -bellW * 0.5, 2 - pulse * 4, leftLipX, leftLipY);
        ctx.closePath();

        // Chất liệu gelatin trong suốt quang học
        const bellGrad = ctx.createRadialGradient(0, apexY * 0.3, 2, 0, 0, bellW * 1.15);
        bellGrad.addColorStop(0, `rgba(255, 255, 255, 0.48)`);
        bellGrad.addColorStop(0.38, `${this.color}38`);
        bellGrad.addColorStop(0.75, `${this.color}16`);
        bellGrad.addColorStop(0.95, `rgba(255, 255, 255, 0.42)`);
        bellGrad.addColorStop(1, `${this.color}65`);

        ctx.fillStyle = bellGrad;
        ctx.fill();

        // Viền phản quang mỏng óng ánh
        ctx.strokeStyle = `rgba(255, 255, 255, 0.75)`;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // ============================================
        // 4. CƠ QUAN PHÁT QUANG DẠ QUANG Ở TÂM CHUÔNG (HORSESHOE GONADS)
        // ============================================
        const gonadRadius = 8.5 * (1 - pulse * 0.15);
        const gonadDist = 11.5 * (1 - pulse * 0.15);
        const gonadAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

        gonadAngles.forEach(ang => {
            const gx = Math.cos(ang) * gonadDist;
            const gy = (apexY * 0.35) + Math.sin(ang) * (gonadDist * 0.65);

            ctx.beginPath();
            ctx.arc(gx, gy, gonadRadius, 0, Math.PI * 2);
            const gGrad = ctx.createRadialGradient(gx, gy, 0.5, gx, gy, gonadRadius);
            gGrad.addColorStop(0, `rgba(255, 255, 255, 0.88)`);
            gGrad.addColorStop(0.5, `${this.color}95`);
            gGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = gGrad;
            ctx.fill();

            ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
        });

        // Điểm sáng mắt rhopalia lấp lánh ở vành chuông
        for (let i = -3; i <= 3; i++) {
            const rx = (i / 3) * (bellW * 0.92);
            const ry = 7 + rimFlare + Math.sin(i * 1.5 + this.phase) * 2;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.restore();
    }
}

// Khởi tạo engine khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    window.oceanEngine = new OceanEngine('ocean-canvas');
});

