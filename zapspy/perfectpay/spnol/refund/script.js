/**
 * Refund Request Page Script v2
 * Multi-step form with security validation, friction, and WhatsApp bridge
 */

const WHATSAPP_NUMBER = '5527981346417';
const LANG = 'es';
const MIN_FEEDBACK_CHARS = 50;

const countries = [
    { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
    { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
    { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
    { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
    { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
    { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
    { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
    { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
    { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
    { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
    { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
    { code: 'PE', name: 'Peru', dial: '+51', flag: '🇵🇪' },
    { code: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
    { code: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
    { code: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾' },
    { code: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾' },
    { code: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴' },
    { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
    { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
    { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
    { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
    { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
    { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
    { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
    { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
    { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
    { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
    { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
    { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
    { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
    { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
    { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
    { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
    { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
    { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
    { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
    { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
    { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
    { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
    { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
    { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
    { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
    { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
    { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
    { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
    { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
    { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
    { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' }
];

let selectedCountry = countries[8];
let currentStep = 1;

// ==================== STEP 0: VALIDATION SCREEN ====================

document.addEventListener('DOMContentLoaded', function() {
    runValidationScreen();
});

function runValidationScreen() {
    const steps = [
        { id: 'vStep1', delay: 0, duration: 4000 },
        { id: 'vStep2', delay: 4000, duration: 4000 },
        { id: 'vStep3', delay: 8000, duration: 4000 },
        { id: 'vStep4', delay: 12000, duration: 3000 }
    ];
    const totalDuration = 15000;
    const bar = document.getElementById('validationBar');
    const pct = document.getElementById('validationPercent');
    const startTime = Date.now();

    // Progress bar animation
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / totalDuration) * 100, 100);
        bar.style.width = progress + '%';
        pct.textContent = Math.round(progress) + '%';
        if (progress >= 100) clearInterval(progressInterval);
    }, 50);

    // Step animations
    steps.forEach((step, index) => {
        setTimeout(() => {
            const el = document.getElementById(step.id);
            el.classList.add('active');
        }, step.delay);

        setTimeout(() => {
            const el = document.getElementById(step.id);
            el.classList.remove('active');
            el.classList.add('completed');
            el.querySelector('.v-step-icon').innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
        }, step.delay + step.duration);
    });

    // After validation completes, show the form
    setTimeout(() => {
        document.getElementById('validationScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('validationScreen').style.display = 'none';
            document.getElementById('mainContent').style.display = 'flex';
            document.getElementById('mainContent').style.animation = 'fadeIn 0.5s ease';
            initForm();
        }, 400);
    }, totalDuration + 500);
}

// ==================== FORM INITIALIZATION ====================

function initForm() {
    initCountrySelector();
    initCharCounter();
    initFormValidation();
    setMaxDate();
}

function setMaxDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseDate').setAttribute('max', today);
}

// ==================== COUNTRY SELECTOR ====================

function initCountrySelector() {
    const countryList = document.getElementById('countryList');
    const countrySelector = document.getElementById('countrySelector');
    const countryDropdown = document.getElementById('countryDropdown');
    const countrySearch = document.getElementById('countrySearch');
    const selectedCountryEl = document.getElementById('selectedCountry');

    function renderCountries(filter = '') {
        const filtered = countries.filter(c =>
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.dial.includes(filter)
        );

        if (filtered.length === 0) {
            countryList.innerHTML = '<div class="no-results">País no encontrado</div>';
            return;
        }

        countryList.innerHTML = filtered.map(country => `
            <div class="country-item ${country.code === selectedCountry.code ? 'selected' : ''}" data-code="${country.code}">
                <span class="flag">${country.flag}</span>
                <span class="name">${country.name}</span>
                <span class="dial-code">${country.dial}</span>
            </div>
        `).join('');

        countryList.querySelectorAll('.country-item').forEach(item => {
            item.addEventListener('click', function() {
                selectCountryFn(this.dataset.code);
                closeDropdown();
            });
        });
    }

    function selectCountryFn(code) {
        selectedCountry = countries.find(c => c.code === code);
        selectedCountryEl.innerHTML = `
            <span class="flag">${selectedCountry.flag}</span>
            <span class="code">${selectedCountry.dial}</span>
            <span class="arrow">▼</span>
        `;
        renderCountries(countrySearch.value);
    }

    function openDropdown() {
        countryDropdown.classList.add('active');
        countrySelector.classList.add('open');
        countrySearch.value = '';
        countrySearch.focus();
        renderCountries();
        setTimeout(() => {
            const selectedItem = countryList.querySelector('.country-item.selected');
            if (selectedItem) selectedItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 100);
    }

    function closeDropdown() {
        countryDropdown.classList.remove('active');
        countrySelector.classList.remove('open');
    }

    selectedCountryEl.addEventListener('click', function(e) {
        e.stopPropagation();
        countryDropdown.classList.contains('active') ? closeDropdown() : openDropdown();
    });

    countrySearch.addEventListener('input', function() { renderCountries(this.value); });
    countrySearch.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeDropdown();
        else if (e.key === 'Enter') {
            const firstItem = countryList.querySelector('.country-item');
            if (firstItem) { selectCountryFn(firstItem.dataset.code); closeDropdown(); }
        }
    });

    document.addEventListener('click', function(e) {
        if (!countrySelector.contains(e.target)) closeDropdown();
    });

    renderCountries();
}

// ==================== CHARACTER COUNTER ====================

function initCharCounter() {
    const details = document.getElementById('details');
    const charCount = document.getElementById('charCount');
    const charStatus = document.getElementById('charStatus');

    details.addEventListener('input', function() {
        const len = this.value.trim().length;
        charCount.textContent = len;

        if (len >= MIN_FEEDBACK_CHARS) {
            charStatus.textContent = '✓ Suficiente';
            charStatus.className = 'char-status sufficient';
            charCount.parentElement.className = 'char-counter sufficient';
        } else {
            charStatus.textContent = '⚠ Se necesitan más detalles';
            charStatus.className = 'char-status';
            charCount.parentElement.className = 'char-counter';
        }
    });
}

// ==================== FORM VALIDATION ====================

function initFormValidation() {
    document.getElementById('refundForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateStep(3)) submitForm();
    });
}

function nextStep(step) {
    if (validateStep(currentStep)) {
        document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.add('completed');
        currentStep = step;
        updateProgress(step);
        showStep(step);
    }
}

function prevStep(step) {
    currentStep = step;
    updateProgress(step);
    showStep(step);
}

function updateProgress(step) {
    document.querySelectorAll('.progress-step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active');
        if (s === step) el.classList.add('active');
    });
}

function showStep(step) {
    document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
    document.querySelector(`.form-step[data-step="${step}"]`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step) {
    let isValid = true;

    if (step === 1) {
        const fullName = document.getElementById('fullName');
        if (!fullName.value.trim() || fullName.value.trim().length < 3) {
            showError('fullName', 'Por favor ingresa tu nombre completo');
            isValid = false;
        } else { clearError('fullName'); }

        const email = document.getElementById('email');
        if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
            showError('email', 'Por favor ingresa un email válido');
            isValid = false;
        } else { clearError('email'); }

        const phone = document.getElementById('phone');
        if (!phone.value.trim() || phone.value.length < 6) {
            showError('phone', 'Por favor ingresa un número de teléfono válido');
            isValid = false;
        } else { clearError('phone'); }
    }

    if (step === 2) {
        const purchaseDate = document.getElementById('purchaseDate');
        if (!purchaseDate.value) {
            showError('purchaseDate', 'Por favor selecciona la fecha de compra');
            isValid = false;
        } else { clearError('purchaseDate'); }

        const reason = document.getElementById('reason');
        if (!reason.value) {
            showError('reason', 'Por favor selecciona una razón');
            isValid = false;
        } else { clearError('reason'); }
    }

    if (step === 3) {
        const details = document.getElementById('details');
        const len = details.value.trim().length;
        if (len < MIN_FEEDBACK_CHARS) {
            showError('details', `Por favor proporciona al menos ${MIN_FEEDBACK_CHARS} caracteres. Tienes ${len} caracteres.`);
            isValid = false;
        } else { clearError('details'); }
    }

    return isValid;
}

function showError(fieldId, message) {
    const errorEl = document.getElementById(fieldId + 'Error');
    const inputEl = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.style.borderColor = 'var(--error-color)';
}

function clearError(fieldId) {
    const errorEl = document.getElementById(fieldId + 'Error');
    const inputEl = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = '';
    if (inputEl) inputEl.style.borderColor = 'var(--border-color)';
}

// ==================== FORM SUBMISSION ====================

async function submitForm() {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    const reasonSelect = document.getElementById('reason');
    const reasonText = reasonSelect.options[reasonSelect.selectedIndex].text;

    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: selectedCountry.dial + ' ' + document.getElementById('phone').value.trim(),
        countryCode: selectedCountry.code,
        purchaseDate: document.getElementById('purchaseDate').value,
        reason: reasonSelect.value,
        details: document.getElementById('details').value.trim(),
        submittedAt: new Date().toISOString()
    };

    const protocol = generateProtocol();

    try {
        await sendRefundRequest(formData, protocol);

        document.getElementById('protocolNumber').textContent = protocol;
        document.getElementById('summaryName').textContent = formData.fullName;
        document.getElementById('summaryEmail').textContent = formData.email;

        // Build WhatsApp URL with pre-filled message
        const waMessage = encodeURIComponent(
            `Hola, soy ${formData.fullName} y quiero confirmar mi solicitud de reembolso de Whats Spy (Protocolo: ${protocol}). Motivo: ${reasonText}.`
        );
        document.getElementById('whatsappBtn').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`;

        document.querySelector('.progress-step[data-step="3"]').classList.add('completed');
        currentStep = 4;
        updateProgress(4);
        showStep(4);

        window.refundData = { ...formData, protocol };

    } catch (error) {
        console.error('Error submitting refund:', error);
        showToast('Error al enviar la solicitud. Por favor intenta de nuevo.', 'error');
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
}

function generateProtocol() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `REF-${timestamp}${random}`;
}

async function sendRefundRequest(data, protocol) {
    const API_URL = window.ZAPSPY_API_URL || 'https://zapspy-backend-production.up.railway.app';

    try {
        const response = await fetch(`${API_URL}/api/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                protocol,
                language: LANG,
                visitorId: (typeof visitorId !== 'undefined' ? visitorId : null)
            })
        });

        if (!response.ok) throw new Error('Failed to submit refund request');
        return await response.json();
    } catch (error) {
        console.warn('Backend not available, storing locally:', error);
        const refunds = JSON.parse(localStorage.getItem('refundRequests') || '[]');
        refunds.push({ ...data, protocol, status: 'pending' });
        localStorage.setItem('refundRequests', JSON.stringify(refunds));
        return { success: true, protocol };
    }
}

// ==================== UTILITIES ====================

function copyProtocol() {
    const protocol = document.getElementById('protocolNumber').textContent;
    navigator.clipboard.writeText(protocol).then(() => {
        showToast('¡Número de protocolo copiado!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = protocol;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('¡Número de protocolo copiado!', 'success');
    });
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
