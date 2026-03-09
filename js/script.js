document.addEventListener('DOMContentLoaded', () => {
    // Scroll reveal animation
    const reveals = document.querySelectorAll('.reveal, .reveal-up, .reveal-right');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const revealPoint = 100;

        reveals.forEach(reveal => {
            const revealTop = reveal.getBoundingClientRect().top;
            if (revealTop < windowHeight - revealPoint) {
                reveal.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger once on load

    // Smooth smooth scrolling for anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href === '#') {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            } else {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Language Toggle Logic
    const langViBtn = document.getElementById('lang-vi');
    const langEnBtn = document.getElementById('lang-en');

    // Default language
    let currentLang = 'vi';

    window.changeLanguage = (lang) => {
        currentLang = lang;
        document.documentElement.lang = lang;

        // Update language toggle styling
        if (lang === 'vi') {
            langViBtn.classList.add('active');
            langEnBtn.classList.remove('active');
        } else {
            langEnBtn.classList.add('active');
            langViBtn.classList.remove('active');
        }

        // Apply translations
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[lang][key]) {
                el.innerHTML = langData[lang][key];
            }
        });

        // Trigger countdown update to refresh translated 'days'
        if (typeof window.updateCountdownTimer === 'function') {
            window.updateCountdownTimer();
        }
    };

    langViBtn.addEventListener('click', () => changeLanguage('vi'));
    langEnBtn.addEventListener('click', () => changeLanguage('en'));

    // Countdown Timer Logic
    const initCountdown = async () => {
        const timers = document.querySelectorAll('.countdown-timer');
        if (timers.length === 0) return;

        // Sync session to get potential server-side deadline
        const user = await window.SAFEALL_API.initSession();

        // 1. Determine Source of Truth for Deadline
        let deadline;

        if (user && user.sale_deadline) {
            // Priority: Server-side deadline
            deadline = parseInt(user.sale_deadline, 10);
        } else {
            // Fallback: localStorage for guest or first-time user
            deadline = localStorage.getItem('safeall_sale_deadline');
            if (!deadline) {
                deadline = new Date().getTime() + (24 * 60 * 60 * 1000);
                localStorage.setItem('safeall_sale_deadline', deadline);
            } else {
                deadline = parseInt(deadline, 10);
                if (new Date().getTime() > deadline) {
                    deadline = new Date().getTime() + (24 * 60 * 60 * 1000);
                    localStorage.setItem('safeall_sale_deadline', deadline);
                }
            }

            // If logged in but no server deadline, sync this one up
            if (user && user.phone !== 'admin') {
                await window.SAFEALL_API.updateProfile({ sale_deadline: deadline });
            }
        }

        window.updateCountdownTimer = () => {
            const now = new Date().getTime();
            const distance = deadline - now;

            if (distance < 0) {
                // Reset for another 24h if expired
                deadline = new Date().getTime() + (24 * 60 * 60 * 1000);
                if (user && user.phone !== 'admin') {
                    window.SAFEALL_API.updateProfile({ sale_deadline: deadline });
                } else {
                    localStorage.setItem('safeall_sale_deadline', deadline);
                }
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const dayStr = langData[currentLang]?.time_days || 'Ngày';
            const h = hours.toString().padStart(2, '0');
            const m = minutes.toString().padStart(2, '0');
            const s = seconds.toString().padStart(2, '0');

            timers.forEach(timer => {
                if (days > 0) {
                    timer.innerText = `${days} ${dayStr} ${h}:${m}:${s}`;
                } else {
                    timer.innerText = `${h}:${m}:${s}`;
                }
            });
        };

        window.updateCountdownTimer();
        setInterval(window.updateCountdownTimer, 1000);
    };

    initCountdown();

    // Image Modal Logic
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");
    const captionText = document.getElementById("modalCaption");
    const closeBtn = document.getElementsByClassName("modal-close")[0];

    // Get all images that should be clickable
    const imagesToEnlarge = document.querySelectorAll('.sp-col.img img, .product-detail-image img');

    imagesToEnlarge.forEach(img => {
        img.addEventListener('click', function () {
            modal.style.display = "block";
            modalImg.src = this.src;
            captionText.innerHTML = this.alt;
        });
    });

    if (closeBtn) {
        closeBtn.onclick = function () {
            modal.style.display = "none";
        }
    }

    // Close modal when clicking outside the image
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // --- Image Hover Zoom Logic ---
    function imageZoom(img, result, lens) {
        let cx, cy;

        lens.addEventListener("mousemove", moveLens);
        img.addEventListener("mousemove", moveLens);
        lens.addEventListener("touchmove", moveLens);
        img.addEventListener("touchmove", moveLens);

        img.addEventListener("mouseenter", () => {
            lens.style.display = "block";
            result.style.display = "block";
            cx = result.offsetWidth / lens.offsetWidth;
            cy = result.offsetHeight / lens.offsetHeight;
            if (img.complete) {
                result.style.backgroundImage = "url('" + img.src + "')";
                result.style.backgroundSize = (img.width * cx) + "px " + (img.height * cy) + "px";
            }
        });

        img.parentElement.addEventListener("mouseleave", () => {
            lens.style.display = "none";
            result.style.display = "none";
        });

        function moveLens(e) {
            let pos, x, y;
            e.preventDefault();
            pos = getCursorPos(e);
            x = pos.x - (lens.offsetWidth / 2);
            y = pos.y - (lens.offsetHeight / 2);
            if (x > img.width - lens.offsetWidth) { x = img.width - lens.offsetWidth; }
            if (x < 0) { x = 0; }
            if (y > img.height - lens.offsetHeight) { y = img.height - lens.offsetHeight; }
            if (y < 0) { y = 0; }
            lens.style.left = x + "px";
            lens.style.top = y + "px";
            result.style.backgroundPosition = "-" + (x * cx) + "px -" + (y * cy) + "px";
        }

        function getCursorPos(e) {
            let a, x = 0, y = 0;
            e = e || window.event;
            a = img.getBoundingClientRect();
            x = e.pageX - a.left - window.scrollX;
            y = e.pageY - a.top - window.scrollY;
            return { x: x, y: y };
        }
    }

    const zoomableImagesContainers = document.querySelectorAll('.sp-col.img');
    zoomableImagesContainers.forEach((container, index) => {
        const img = container.querySelector('img');
        if (!img) return; // Skip if it's a placeholder without img tag

        // Add container class
        container.classList.add('img-zoom-container');

        // Create lens
        const lens = document.createElement("DIV");
        lens.className = "img-zoom-lens";
        container.insertBefore(lens, img);

        // Create result div
        const result = document.createElement("div");
        result.className = "img-zoom-result";
        result.id = `zoomResult${index}`;
        container.appendChild(result);

        // Init zoom
        imageZoom(img, result, lens);
    });
});
