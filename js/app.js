/**
 * App.js - Điều khiển tương tác chính của Website Profile Đại Dương Sâu
 * 1. Modal hỏi âm thanh khi vừa vào trang & chuyển cảnh mượt.
 * 2. Cập nhật HUD độ sâu (Depth Meter) theo cuộn trang.
 * 3. Cuộc rượt đuổi: Đàn cá nhỏ & Cá mập săn mồi theo cuộn chuột (thay thế ném lao).
 * 4. Chuyển cảnh dẫn tới mục "Về Tôi".
 * 5. Điều khiển âm thanh & bộ chỉnh âm (Equalizer).
 * 6. Hiệu ứng Reveal & Magnetic Buttons.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // 1. MODAL ÂM THANH KHI VỪA VÀO TRANG (GHI NHỚ PHIÊN TRẢI NGHIỆM)
    // ============================================
    const audioModal = document.getElementById('audio-modal');
    const btnSoundYes = document.getElementById('btn-sound-yes');
    const btnSoundNo = document.getElementById('btn-sound-no');
    const hudSoundToggle = document.getElementById('hud-sound-toggle');
    const navSoundToggle = document.getElementById('nav-sound-toggle');
    const soundEqualizer = document.querySelectorAll('.sound-eq');

    function updateSoundUI(isOn) {
        soundEqualizer.forEach(eq => {
            if (isOn) {
                eq.classList.add('playing');
                eq.classList.remove('muted');
            } else {
                eq.classList.remove('playing');
                eq.classList.add('muted');
            }
        });

        const labels = document.querySelectorAll('.sound-status-text');
        labels.forEach(lbl => {
            lbl.textContent = isOn ? 'Bật' : 'Tắt';
        });
    }

    function dismissModal(enableSound) {
        if (enableSound && window.oceanAudio) {
            window.oceanAudio.unmute();
            updateSoundUI(true);
            sessionStorage.setItem('ocean_audio_pref', 'enabled');
        } else if (window.oceanAudio) {
            window.oceanAudio.mute();
            updateSoundUI(false);
            sessionStorage.setItem('ocean_audio_pref', 'muted');
        }
        sessionStorage.setItem('ocean_audio_dismissed', 'true');

        if (audioModal) {
            audioModal.classList.add('fade-out');
            setTimeout(() => {
                audioModal.style.display = 'none';
            }, 600);
        }
    }

    // Kiểm tra nếu người dùng đã từng chọn hoặc quay lại từ shop.html -> Không hiện lại modal che đại dương
    const savedAudioPref = sessionStorage.getItem('ocean_audio_pref');
    const isDismissed = sessionStorage.getItem('ocean_audio_dismissed');
    const isFromShop = document.referrer.includes('shop.html') || window.location.search.includes('from=shop');

    if (savedAudioPref || isDismissed || isFromShop) {
        if (audioModal) {
            audioModal.style.display = 'none';
        }
        if (savedAudioPref === 'enabled') {
            // Khi có tương tác người dùng đầu tiên sẽ kích hoạt audio
            const resumeOnInteraction = () => {
                if (window.oceanAudio) {
                    window.oceanAudio.unmute();
                    updateSoundUI(true);
                }
                window.removeEventListener('click', resumeOnInteraction);
                window.removeEventListener('keydown', resumeOnInteraction);
            };
            window.addEventListener('click', resumeOnInteraction, { once: true });
            window.addEventListener('keydown', resumeOnInteraction, { once: true });
        } else {
            updateSoundUI(false);
        }
    }

    if (btnSoundYes) {
        btnSoundYes.addEventListener('click', () => dismissModal(true));
    }

    if (btnSoundNo) {
        btnSoundNo.addEventListener('click', () => dismissModal(false));
    }

    // Nút bật/tắt âm thanh trên HUD và Navbar
    function toggleAudio() {
        if (!window.oceanAudio) return;
        const isNowPlaying = window.oceanAudio.toggle();
        updateSoundUI(isNowPlaying);
    }

    if (hudSoundToggle) hudSoundToggle.addEventListener('click', toggleAudio);
    if (navSoundToggle) navSoundToggle.addEventListener('click', toggleAudio);

    const hudSoundTest = document.getElementById('hud-sound-test');
    if (hudSoundTest) {
        hudSoundTest.addEventListener('click', () => {
            if (window.oceanAudio) {
                window.oceanAudio.testMarineSound();
                updateSoundUI(true);
            }
        });
    }

    // ============================================
    // 2. HUD ĐỘ SÂU ĐẠI DƯƠNG (DEPTH METER)
    // ============================================
    const depthMeter = document.getElementById('depth-meter');
    const depthZone = document.getElementById('depth-zone');
    const depthProgress = document.getElementById('depth-progress-fill');

    function updateDepthHUD(progress) {
        // Tối đa 3,850 mét (Đáy vực thẳm)
        const meters = Math.round(progress * 3850);
        if (depthMeter) {
            depthMeter.textContent = `${meters.toLocaleString('vi-VN')} m`;
        }

        if (depthProgress) {
            depthProgress.style.height = `${progress * 100}%`;
        }

        if (depthZone) {
            if (meters < 50) {
                depthZone.textContent = 'Mặt Biển (0m)';
            } else if (meters < 200) {
                depthZone.textContent = 'Vùng Quang Hợp (Sunlight)';
            } else if (meters < 1000) {
                depthZone.textContent = 'Vùng Hoàng Hôn (Twilight)';
            } else if (meters < 2500) {
                depthZone.textContent = 'Vùng Nửa Đêm (Midnight)';
            } else {
                depthZone.textContent = 'Vực Thẳm Đáy Biển (Abyss)';
            }
        }

        // Cập nhật nhãn nút nghe thử theo đúng 3 tầng âm thanh
        if (hudSoundTest) {
            const testSpan = hudSoundTest.querySelector('span');
            if (testSpan) {
                if (meters < 300) {
                    testSpan.textContent = 'Thử Tiếng Hải Âu & Gió Biển';
                } else if (meters < 1000) {
                    testSpan.textContent = 'Thử Tiếng Orca & Cá Heo (300-1000m)';
                } else {
                    testSpan.textContent = 'Thử Tiếng Cá Voi Vang Xa (>1000m)';
                }
            }
        }
    }

    // ============================================
    // 3. CUỘC RƯỢT ĐUỔI: CÁ MẬP ĐUỔI ĐÀN CÁ NHỎ
    // ============================================
    const chaseSection = document.getElementById('ocean-chase');
    const fishSchool = document.getElementById('chase-fish-school');
    const shark = document.getElementById('chase-shark');
    const chaseAlert = document.getElementById('chase-alert');
    const chaseBubbleContainer = document.getElementById('chase-bubbles');

    let lastScrollTime = Date.now();
    let lastScrollPos = window.scrollY;
    let swimRateTimeout = null;

    // Khởi tạo các bọt nước bùng nổ khi cá mập tăng tốc
    if (chaseBubbleContainer && chaseBubbleContainer.children.length === 0) {
        for (let i = 0; i < 25; i++) {
            const b = document.createElement('div');
            b.className = 'chase-bubble';
            b.style.left = `${Math.random() * 100}%`;
            b.style.top = `${Math.random() * 100}%`;
            b.style.width = `${4 + Math.random() * 10}px`;
            b.style.height = b.style.width;
            chaseBubbleContainer.appendChild(b);
        }
    }

    // ============================================
    // 4. LẮNG NGHE CUỘN TRANG & ĐIỀU KHIỂN HOẠT CẢNH
    // ============================================
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const totalDocHeight = document.documentElement.scrollHeight - window.innerHeight;
        const globalProgress = totalDocHeight > 0 ? Math.max(0, Math.min(1, scrollY / totalDocHeight)) : 0;

        // Tính tốc độ cuộn chuột để tăng tốc độ quẫy đuôi cá mập (Dynamic Swim Velocity)
        const now = Date.now();
        const dt = Math.max(1, now - lastScrollTime);
        const dist = Math.abs(scrollY - lastScrollPos);
        const scrollSpeed = dist / dt;
        lastScrollTime = now;
        lastScrollPos = scrollY;

        if (shark) {
            const activeRate = scrollSpeed > 0.4 ? '0.52s' : '0.85s';
            shark.style.setProperty('--swim-rate', activeRate);
            if (fishSchool) fishSchool.style.setProperty('--school-rate', '0.38s');

            clearTimeout(swimRateTimeout);
            swimRateTimeout = setTimeout(() => {
                shark.style.setProperty('--swim-rate', '1.15s');
                if (fishSchool) fishSchool.style.setProperty('--school-rate', '0.65s');
            }, 300);
        }

        // Cập nhật chỉ số HUD độ sâu
        updateDepthHUD(globalProgress);

        // XỬ LÝ HOẠT CẢNH RƯỢT ĐUỔI (CHASE SCENE)
        if (chaseSection) {
            const rect = chaseSection.getBoundingClientRect();
            const totalScroll = rect.height - window.innerHeight;
            let progress = -rect.top / totalScroll;
            progress = Math.max(0, Math.min(1, progress));

            // Quỹ đạo di chuyển từ trái sang phải:
            // Đàn cá nhỏ bơi trước (bên phải), cá mập lao theo sau (bên trái)
            if (fishSchool && shark) {
                // Đàn cá nhỏ chạy trước: từ 10vw đến 138vw (vượt qua mép phải màn hình)
                const fishX = 10 + (progress * 128); 
                const fishY = Math.sin(progress * 11) * 40; 
                const fishRot = Math.sin(progress * 11) * 8;

                fishSchool.style.transform = `translate3d(${fishX}vw, ${fishY}px, 0) rotate(${fishRot}deg)`;

                // Cá mập rượt đuổi phía sau: từ -45vw lao tới 122vw (bám sát đuôi đàn cá)
                const sharkX = -45 + (Math.pow(progress, 1.1) * 167);
                const sharkY = Math.sin(progress * 9 - 0.5) * 32;
                const sharkRot = Math.sin(progress * 9) * 6;

                shark.style.transform = `translate3d(${sharkX}vw, ${sharkY}px, 0) rotate(${sharkRot}deg)`;

                // Cảnh báo săn mồi hiển thị ở giữa chặng
                if (chaseAlert) {
                    if (progress > 0.15 && progress < 0.85) {
                        chaseAlert.style.opacity = '1';
                        chaseAlert.style.transform = 'translate(-50%, 0) scale(1)';
                    } else {
                        chaseAlert.style.opacity = '0';
                        chaseAlert.style.transform = 'translate(-50%, -20px) scale(0.9)';
                    }
                }

                // Kích hoạt bọt nước rẽ sóng khi cá mập bơi qua
                if (chaseBubbleContainer) {
                    if (progress > 0.2 && progress < 0.9) {
                        chaseBubbleContainer.style.opacity = '1';
                    } else {
                        chaseBubbleContainer.style.opacity = '0';
                    }
                }
            }
        }
    }, { passive: true });

    // ============================================
    // 5. INTERSECTION OBSERVER CHO CÁC PHẦN TỬ REVEAL
    // ============================================
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -40px 0px"
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.service-card, .bento-item, .ocean-floor-card').forEach(el => {
        el.classList.add('fade-in-up');
        revealObserver.observe(el);
    });

    // ============================================
    // 6. HIỆU ỨNG TỪ TÍNH (MAGNETIC BUTTONS)
    // ============================================
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
        });
    });

    // ============================================
    // 7. SMOOTH SCROLL KHI CLICK VÀO NAV VÀ CTA
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ============================================
    // 8. SAO CHÉP GMAIL VÀO CLIPBOARD & ZALO HELPER
    // ============================================
    const btnCopyGmail = document.getElementById('btn-copy-gmail');
    const copyStatusText = document.getElementById('copy-status-text');

    if (btnCopyGmail) {
        btnCopyGmail.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const email = 'vinhanct2023@gmail.com';
            try {
                await navigator.clipboard.writeText(email);
                if (copyStatusText) {
                    copyStatusText.textContent = 'Đã Chép!';
                    btnCopyGmail.classList.add('copied');
                    setTimeout(() => {
                        copyStatusText.textContent = 'Sao Chép';
                        btnCopyGmail.classList.remove('copied');
                    }, 2500);
                }
            } catch (err) {
                // Fallback nếu browser chặn
                const tempInput = document.createElement('input');
                tempInput.value = email;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                if (copyStatusText) {
                    copyStatusText.textContent = 'Đã Chép!';
                    btnCopyGmail.classList.add('copied');
                    setTimeout(() => {
                        copyStatusText.textContent = 'Sao Chép';
                        btnCopyGmail.classList.remove('copied');
                    }, 2500);
                }
            }
        });
    }

    const bentoZaloLink = document.getElementById('bento-zalo-link');
    if (bentoZaloLink) {
        bentoZaloLink.addEventListener('click', (e) => {
            const href = bentoZaloLink.getAttribute('href');
            if (href === 'https://zalo.me/' || href === 'https://zalo.me') {
                // Chưa gắn số điện thoại
                console.log('Mẹo Zalo: Hãy đổi href="https://zalo.me/<sdt>" trong index.html với sdt của bạn để chat trực tiếp!');
            }
        });
    }

    // ============================================
    // DỊCH VỤ: HIỂN THỊ THÔNG BÁO CHO CÁC MỤC ĐANG PHÁT TRIỂN
    // (Trừ mục Thương Mại & Tự Động Hóa dẫn thẳng tới shop.html)
    // ============================================
    const serviceToast = document.getElementById('service-toast');
    const toastCloseBtn = document.getElementById('toast-close-btn');
    let toastTimeout = null;

    window.showServiceToast = function(customMessage) {
        if (!serviceToast) return;
        if (customMessage) {
            const msgEl = serviceToast.querySelector('.toast-message');
            if (msgEl) msgEl.textContent = customMessage;
        }

        serviceToast.classList.add('active');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            serviceToast.classList.remove('active');
        }, 4000);
    };

    if (toastCloseBtn) {
        toastCloseBtn.addEventListener('click', () => {
            if (serviceToast) serviceToast.classList.remove('active');
            if (toastTimeout) clearTimeout(toastTimeout);
        });
    }

    // Bắt sự kiện click vào các thẻ dịch vụ đang phát triển
    document.querySelectorAll('.service-card-notice').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const serviceName = card.getAttribute('data-service-name') || 'Dịch vụ này';
            window.showServiceToast(`Trang web sẽ được hoàn thành sớm thôi, xin vui lòng đợi`);
        });
    });
});


