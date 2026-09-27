/**
 * WeatherModule - Hệ thống Tích Hợp API Thời Tiết, Giờ GMT+7 & Trạng Thái Bầu Trời Cần Thơ
 * - Kết nối trực tiếp Open-Meteo API (Thời tiết, AQI & Giờ thực tế GMT+7 tại Cần Thơ)
 * - Tự động tính toán chu kỳ thời gian trong ngày (Bình Minh 5:30-7:00, Ban Ngày 7:00-16:30, Hoàng Hôn 16:30-17:30, Buổi Đêm 17:30-5:30)
 * - Tự động đồng bộ màu chữ của Hero Section (#hero-content, #hero-title, #hero-badge) thích ứng theo bầu trời để luôn nổi bật, sắc nét
 * - 4 Chế độ: Nắng (Sunny), Mưa (Rainy), Buổi Đêm (Night) và Thực Tế (Live API + GMT+7)
 * - Đồng bộ với động cơ đồ họa OceanCanvas để đổi hiệu ứng sao trời, mặt trăng, mặt trời, mây và sóng biển
 */

class WeatherModule {
    constructor() {
        this.city = 'Cần Thơ';
        this.lat = 10.0452;
        this.lon = 105.7469;
        
        // Chế độ: 'auto' (thực tế theo giờ GMT+7 & API), 'sunny' (nắng), 'rainy' (mưa), 'night' (đêm)
        this.mode = 'auto';
        this.isRaining = false;
        this.skyPhase = 'day'; // 'dawn', 'day', 'dusk', 'night'
        this.currentHourDec = 14.5;
        this.clockTimer = null;
        this.isCollapsed = true; // Mặc định thu gọn theo yêu cầu: chỉ hiện icon thời tiết + nhiệt độ
        
        this.data = {
            temp: 31,
            humidity: 68,
            windSpeed: 11,
            weatherCode: 1,
            aqi: 35,
            aqiStatus: 'Tốt',
            aqiColor: '#10b981',
            conditionText: 'Nắng nhẹ & Có mây',
            iconType: 'cloudy-sun',
            timeString: '--:--:--'
        };

        this.widgetEl = document.getElementById('weather-widget');
        this.init();
    }

    async init() {
        this.startLiveClock();
        this.bindEvents();
        await this.fetchRealData();
        this.updateSkyPhase();
        this.updateUI();
        this.applyWeatherToCanvas();
    }

    // Khởi tạo đồng hồ thời gian thực GMT+7 cập nhật mỗi giây
    startLiveClock() {
        const updateTime = () => {
            try {
                const now = new Date();
                const formatter = new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                const timeStr = formatter.format(now);
                this.data.timeString = timeStr;

                // Tính toán giờ dưới dạng số thập phân (Ví dụ 17h30 = 17.5)
                const parts = timeStr.split(':');
                if (parts.length === 3) {
                    const h = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const s = parseInt(parts[2], 10);
                    this.currentHourDec = h + (m / 60) + (s / 3600);
                }

                const clockEl = document.getElementById('live-gmt7-clock');
                if (clockEl) {
                    clockEl.textContent = timeStr;
                }

                // Nếu đang ở chế độ auto thì kiểm tra chuyển pha bầu trời tự động
                if (this.mode === 'auto') {
                    const prevPhase = this.skyPhase;
                    this.updateSkyPhase();
                    if (prevPhase !== this.skyPhase) {
                        this.updateUI();
                        this.applyWeatherToCanvas();
                    }
                }
            } catch (e) {
                console.error('Lỗi cập nhật đồng hồ GMT+7:', e);
            }
        };

        updateTime();
        this.clockTimer = setInterval(updateTime, 1000);
    }

    // Tính toán trạng thái bầu trời dựa theo giờ GMT+7 hoặc chế độ mô phỏng
    updateSkyPhase() {
        if (this.mode === 'sunny') {
            this.skyPhase = 'day';
        } else if (this.mode === 'night') {
            this.skyPhase = 'night';
        } else if (this.mode === 'rainy') {
            this.skyPhase = (this.currentHourDec >= 17.5 || this.currentHourDec < 5.5) ? 'night' : 'day';
        } else {
            // Chế độ 'auto' theo múi giờ GMT+7 Cần Thơ:
            // - Từ 17h30 đến 5h30 sáng: Buổi Đêm (Night)
            // - Từ 5h30 đến 7h00 sáng: Bình Minh (Dawn)
            // - Từ 7h00 đến 16h30 chiều: Ban Ngày (Day)
            // - Từ 16h30 đến 17h30 chiều: Hoàng Hôn (Dusk)
            const h = this.currentHourDec;
            if (h >= 17.5 || h < 5.5) {
                this.skyPhase = 'night';
            } else if (h >= 5.5 && h < 7.0) {
                this.skyPhase = 'dawn';
            } else if (h >= 16.5 && h < 17.5) {
                this.skyPhase = 'dusk';
            } else {
                this.skyPhase = 'day';
            }
        }
    }

    bindEvents() {
        // Nút mở rộng (từ Compact Pill phóng to thành Card chi tiết)
        const toggleBtn = document.getElementById('weather-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setCollapsed(false);
            });
        }

        // Nút thu gọn (từ Card chi tiết thu lại về Compact Pill)
        const collapseBtn = document.getElementById('weather-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setCollapsed(true);
            });
        }

        // Click ra ngoài card khi đang mở rộng thì tự thu gọn về mini pill
        document.addEventListener('click', (e) => {
            if (!this.isCollapsed && this.widgetEl && !this.widgetEl.contains(e.target)) {
                this.setCollapsed(true);
            }
        });

        // Lắng nghe các nút chuyển chế độ (Nắng, Mưa, Đêm, Thực tế)
        const btnSunny = document.getElementById('weather-btn-sunny');
        const btnRainy = document.getElementById('weather-btn-rainy');
        const btnNight = document.getElementById('weather-btn-night');
        const btnAuto = document.getElementById('weather-btn-auto');

        if (btnSunny) {
            btnSunny.addEventListener('click', () => this.setMode('sunny'));
        }
        if (btnRainy) {
            btnRainy.addEventListener('click', () => this.setMode('rainy'));
        }
        if (btnNight) {
            btnNight.addEventListener('click', () => this.setMode('night'));
        }
        if (btnAuto) {
            btnAuto.addEventListener('click', () => this.setMode('auto'));
        }

        // Lắng nghe cuộn trang: Khi lặn xuống sâu (> 180px), ẩn widget mượt mà
        window.addEventListener('scroll', () => {
            if (!this.widgetEl) return;
            const scrollY = window.scrollY;
            if (scrollY > 180) {
                this.widgetEl.classList.add('hidden-depth');
            } else {
                this.widgetEl.classList.remove('hidden-depth');
            }
        }, { passive: true });
    }

    setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        if (!this.widgetEl) return;
        if (collapsed) {
            this.widgetEl.classList.add('is-collapsed');
            const toggleBtn = document.getElementById('weather-toggle-btn');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            this.widgetEl.classList.remove('is-collapsed');
            const toggleBtn = document.getElementById('weather-toggle-btn');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        }
    }

    setMode(mode) {
        this.mode = mode;
        
        // Cập nhật trạng thái active của nút
        const buttons = document.querySelectorAll('.weather-mode-pill');
        buttons.forEach(btn => btn.classList.remove('active'));

        const targetBtn = document.getElementById(`weather-btn-${mode}`);
        if (targetBtn) targetBtn.classList.add('active');

        if (mode === 'sunny') {
            this.isRaining = false;
            this.skyPhase = 'day';
            this.data.conditionText = 'Trời Nắng Rực Rỡ';
            this.data.iconType = 'sunny';
        } else if (mode === 'rainy') {
            this.isRaining = true;
            this.skyPhase = (this.currentHourDec >= 17.5 || this.currentHourDec < 5.5) ? 'night' : 'day';
            this.data.conditionText = 'Mưa Rào Tí Tách';
            this.data.iconType = 'rainy';
        } else if (mode === 'night') {
            this.isRaining = false;
            this.skyPhase = 'night';
            this.data.conditionText = 'Bầu Trời Đêm Ngàn Sao';
            this.data.iconType = 'night';
        } else {
            // Chế độ 'auto': Sử dụng dữ liệu API thực tế và giờ GMT+7
            this.updateSkyPhase();
            this.parseWeatherCode(this.data.weatherCode);
        }

        this.updateUI();
        this.applyWeatherToCanvas();
    }

    async fetchRealData() {
        try {
            // 1. Fetch thời tiết Cần Thơ từ Open-Meteo (Múi giờ Asia/Bangkok = GMT+7)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FBangkok`;
            const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${this.lat}&longitude=${this.lon}&current=us_aqi`;

            const [resWeather, resAqi] = await Promise.allSettled([
                fetch(weatherUrl).then(r => r.json()),
                fetch(aqiUrl).then(r => r.json())
            ]);

            if (resWeather.status === 'fulfilled' && resWeather.value?.current) {
                const cur = resWeather.value.current;
                this.data.temp = Math.round(cur.temperature_2m);
                this.data.humidity = cur.relative_humidity_2m;
                this.data.windSpeed = Math.round(cur.wind_speed_10m);
                this.data.weatherCode = cur.weather_code;
                this.parseWeatherCode(cur.weather_code);
            }

            if (resAqi.status === 'fulfilled' && resAqi.value?.current) {
                const aqi = resAqi.value.current.us_aqi;
                this.data.aqi = aqi;
                this.calculateAqiStatus(aqi);
            }
        } catch (err) {
            console.warn('Lỗi khi tải API thời tiết Cần Thơ, sử dụng dữ liệu mặc định tối ưu:', err);
            this.parseWeatherCode(this.data.weatherCode);
            this.calculateAqiStatus(this.data.aqi);
        }
    }

    parseWeatherCode(code) {
        const isNightTime = this.skyPhase === 'night';
        if (code === 0) {
            this.isRaining = false;
            this.data.conditionText = isNightTime ? 'Trời Đêm Quang Mây' : 'Trời Nắng Quang';
            this.data.iconType = isNightTime ? 'night' : 'sunny';
        } else if (code >= 1 && code <= 3) {
            this.isRaining = false;
            this.data.conditionText = code === 3 ? 'Nhiều Mây' : 'Có Mây Nhẹ';
            this.data.iconType = isNightTime ? 'cloudy-night' : 'cloudy-sun';
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            this.isRaining = true;
            this.data.conditionText = 'Mưa Rào Rải Rác';
            this.data.iconType = 'rainy';
        } else if (code >= 95) {
            this.isRaining = true;
            this.data.conditionText = 'Dông Sét & Mưa Rào';
            this.data.iconType = 'thunder';
        } else {
            this.isRaining = false;
            this.data.conditionText = isNightTime ? 'Đêm Yên Bình' : 'Nắng Ráo Êm Ả';
            this.data.iconType = isNightTime ? 'night' : 'cloudy-sun';
        }
    }

    calculateAqiStatus(aqi) {
        if (aqi <= 50) {
            this.data.aqiStatus = 'Rất Tốt';
            this.data.aqiColor = '#10b981'; // Xanh ngọc
        } else if (aqi <= 100) {
            this.data.aqiStatus = 'Trung Bình';
            this.data.aqiColor = '#eab308'; // Vàng tươi
        } else if (aqi <= 150) {
            this.data.aqiStatus = 'Kém';
            this.data.aqiColor = '#f97316'; // Cam
        } else {
            this.data.aqiStatus = 'Nguy Hại';
            this.data.aqiColor = '#ef4444'; // Đỏ
        }
    }

    updateUI() {
        if (!this.widgetEl) return;

        // Cập nhật số liệu chi tiết
        const tempEl = document.getElementById('weather-temp');
        const condEl = document.getElementById('weather-desc');
        const humidEl = document.getElementById('weather-humidity');
        const aqiValEl = document.getElementById('weather-aqi-val');
        const aqiBadgeEl = document.getElementById('weather-aqi-badge');
        const iconWrapEl = document.getElementById('weather-icon-visual');
        const phaseTagEl = document.getElementById('sky-phase-tag');

        // Cập nhật thanh thu gọn (Compact Pill)
        const compactTempEl = document.getElementById('weather-compact-temp');
        const compactIconEl = document.getElementById('weather-compact-icon');
        if (compactTempEl) compactTempEl.textContent = `${this.data.temp}°C`;
        if (compactIconEl) {
            compactIconEl.innerHTML = this.renderWeatherIcon(this.data.iconType);
        }

        if (tempEl) tempEl.textContent = `${this.data.temp}°C`;
        if (condEl) condEl.textContent = this.data.conditionText;
        if (humidEl) humidEl.textContent = `${this.data.humidity}%`;
        if (aqiValEl) aqiValEl.textContent = `${this.data.aqi}`;

        if (aqiBadgeEl) {
            aqiBadgeEl.textContent = this.data.aqiStatus;
            aqiBadgeEl.style.backgroundColor = `${this.data.aqiColor}25`;
            aqiBadgeEl.style.borderColor = this.data.aqiColor;
            aqiBadgeEl.style.color = this.data.aqiColor;
        }

        // Cập nhật thẻ trạng thái bầu trời
        if (phaseTagEl) {
            if (this.skyPhase === 'night') {
                phaseTagEl.innerHTML = '<i class="fa-solid fa-moon"></i> Buổi Đêm';
                phaseTagEl.style.color = '#7dd3fc';
                phaseTagEl.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                phaseTagEl.style.background = 'rgba(14, 165, 233, 0.15)';
            } else if (this.skyPhase === 'dawn') {
                phaseTagEl.innerHTML = '<i class="fa-solid fa-sun"></i> Bình Minh';
                phaseTagEl.style.color = '#fde047';
                phaseTagEl.style.borderColor = 'rgba(253, 224, 71, 0.4)';
                phaseTagEl.style.background = 'rgba(253, 224, 71, 0.15)';
            } else if (this.skyPhase === 'dusk') {
                phaseTagEl.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> Hoàng Hôn';
                phaseTagEl.style.color = '#fb923c';
                phaseTagEl.style.borderColor = 'rgba(251, 146, 60, 0.4)';
                phaseTagEl.style.background = 'rgba(251, 146, 60, 0.15)';
            } else {
                phaseTagEl.innerHTML = '<i class="fa-solid fa-sun"></i> Ban Ngày';
                phaseTagEl.style.color = '#38bdf8';
                phaseTagEl.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                phaseTagEl.style.background = 'rgba(56, 189, 248, 0.12)';
            }
        }

        // Cập nhật icon thời tiết động
        if (iconWrapEl) {
            iconWrapEl.innerHTML = this.renderWeatherIcon(this.data.iconType);
        }
    }

    renderWeatherIcon(type) {
        if (type === 'sunny') {
            return `
                <div class="weather-art sunny-art" title="Trời nắng">
                    <div class="sun-core"></div>
                    <div class="sun-rays"></div>
                </div>
            `;
        } else if (type === 'night') {
            return `
                <div class="weather-art night-art" title="Bầu trời đêm">
                    <div class="moon-crescent"></div>
                    <div class="night-star s1">✦</div>
                    <div class="night-star s2">★</div>
                </div>
            `;
        } else if (type === 'cloudy-night') {
            return `
                <div class="weather-art cloudy-night-art" title="Đêm có mây">
                    <div class="moon-behind"></div>
                    <div class="cloud-body night-cloud"></div>
                </div>
            `;
        } else if (type === 'rainy') {
            return `
                <div class="weather-art rainy-art" title="Trời mưa">
                    <div class="cloud-body rain-cloud"></div>
                    <div class="rain-drops">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;
        } else if (type === 'thunder') {
            return `
                <div class="weather-art thunder-art" title="Dông sét">
                    <div class="cloud-body thunder-cloud"></div>
                    <i class="fa-solid fa-bolt bolt-flash"></i>
                    <div class="rain-drops">
                        <span></span><span></span>
                    </div>
                </div>
            `;
        } else {
            // cloudy-sun
            return `
                <div class="weather-art cloudy-sun-art" title="Nhiều mây có nắng">
                    <div class="sun-behind"></div>
                    <div class="cloud-body"></div>
                </div>
            `;
        }
    }

    // Đổi màu chữ Hero Section thích ứng hoàn hảo với màu nền bầu trời
    updateHeroTextColor(skyPhase, isRaining) {
        const heroContent = document.getElementById('hero-content');
        if (!heroContent) return;

        heroContent.classList.remove('sky-day', 'sky-sunset', 'sky-night', 'sky-rain');

        if (isRaining) {
            heroContent.classList.add('sky-rain');
        } else if (skyPhase === 'night') {
            heroContent.classList.add('sky-night');
        } else if (skyPhase === 'dusk' || skyPhase === 'dawn') {
            heroContent.classList.add('sky-sunset');
        } else {
            heroContent.classList.add('sky-day');
        }
    }

    applyWeatherToCanvas() {
        if (window.oceanEngine) {
            window.oceanEngine.setWeather({
                isRaining: this.isRaining,
                mode: this.mode,
                skyPhase: this.skyPhase,
                isNight: this.skyPhase === 'night',
                isSunset: this.skyPhase === 'dusk',
                isDawn: this.skyPhase === 'dawn',
                cloudType: this.isRaining ? 'stormy' : (this.skyPhase === 'night' ? 'night' : 'fluffy')
            });
        }
        this.updateHeroTextColor(this.skyPhase, this.isRaining);
    }
}

// Hàm toàn cục cho phép kích hoạt đổi màu chữ thủ công khi cần
window.updateHeroTextColor = function(skyState, isRaining) {
    if (window.weatherModule) {
        window.weatherModule.updateHeroTextColor(skyState, isRaining);
    }
};

// Khởi tạo WeatherModule khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    window.weatherModule = new WeatherModule();
});
