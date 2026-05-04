// Language switching logic
const langButtons = document.querySelectorAll('.lang-btn');
const i18nElements = document.querySelectorAll('[data-i18n]');

function updateLanguage(lang) {
    i18nElements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // Update active button state
    langButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Save preference
    localStorage.setItem('preferred-lang', lang);

    // Dispatch custom event for other components (like carousel)
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        updateLanguage(lang);
    });
});

// Initialize with saved or default language
const savedLang = localStorage.getItem('preferred-lang') || 'it';
updateLanguage(savedLang);

// Reveal elements on scroll
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.15
});

revealElements.forEach(el => revealObserver.observe(el));

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
