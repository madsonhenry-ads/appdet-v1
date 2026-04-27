(function(){

    var STORAGE_KEY = 'upsell6_timer_end';
    var TIMER_DURATION = 10 * 60;
    var totalSeconds;
    
    function initTimer() {
        var savedEndTime = localStorage.getItem(STORAGE_KEY);
        if (savedEndTime) {
            var now = Math.floor(Date.now() / 1000);
            var remaining = parseInt(savedEndTime) - now;
            totalSeconds = remaining > 0 ? remaining : 0;
        } else {
            totalSeconds = TIMER_DURATION;
            var endTime = Math.floor(Date.now() / 1000) + totalSeconds;
            localStorage.setItem(STORAGE_KEY, endTime);
        }
    }
    
    function restartTimer() {
        totalSeconds = TIMER_DURATION;
        var endTime = Math.floor(Date.now() / 1000) + totalSeconds;
        localStorage.setItem(STORAGE_KEY, endTime);
    }
    
    var countdownEl = document.getElementById('countdown');
    var countdownCtaEl = document.getElementById('countdown-cta');
    
    function format(seconds){
        if (seconds < 0) seconds = 0;
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    
    function updateTimer() {
        var formatted = format(totalSeconds);
        if (countdownEl) countdownEl.textContent = formatted;
        if (countdownCtaEl) countdownCtaEl.textContent = formatted;
    }
    
    function tick(){
        if (totalSeconds <= 0) { restartTimer(); updateTimer(); return; }
        totalSeconds -= 1;
        updateTimer();
    }
    
    initTimer(); updateTimer(); setInterval(tick, 1000);

    var firstNames = ['María','Carlos','Ana','Luis','Sofia','Miguel','Laura','Diego','Isabella','Alejandro','Valentina','Daniel','Camila','Andrés','Gabriela','Fernando','Daniela','Pablo'];
    var locations = ['Ciudad de México','Buenos Aires','Lima','Bogotá','Santiago','Madrid','Barcelona','Medellín','Guadalajara','Quito','Caracas','Montevideo'];
    var actions = ['actualizó a Multi-Dispositivo','expandió a 3 dispositivos','activó licencia multi-dispositivo','habilitó monitoreo multi-objetivo'];
    
    var activityFeed = document.getElementById('activityFeed');
    
    function getRandomTime() {
        var rand = Math.random();
        if (rand < 0.3) return 'hace ' + Math.floor(Math.random() * 60) + ' seg';
        if (rand < 0.7) return 'hace ' + (Math.floor(Math.random() * 5) + 1) + ' min';
        return 'hace ' + (Math.floor(Math.random() * 10) + 5) + ' min';
    }
    function getRandomName() {
        return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + '.';
    }
    function createActivityItem(isNew) {
        var item = document.createElement('div');
        item.className = 'activity-item' + (isNew ? ' new-item' : '');
        item.innerHTML = '<span class="activity-icon">📱</span> <strong>' + getRandomName() + '</strong> de ' + locations[Math.floor(Math.random() * locations.length)] + ' ' + actions[Math.floor(Math.random() * actions.length)] + ' <span class="activity-time">' + getRandomTime() + '</span>';
        return item;
    }
    function initActivityFeed() {
        if (!activityFeed) return;
        for (var i = 0; i < 3; i++) activityFeed.appendChild(createActivityItem(false));
    }
    function addNewActivity() {
        if (!activityFeed) return;
        var newItem = createActivityItem(true);
        activityFeed.insertBefore(newItem, activityFeed.firstChild);
        setTimeout(function() { newItem.classList.remove('new-item'); }, 600);
        var items = activityFeed.querySelectorAll('.activity-item');
        if (items.length > 3) {
            var lastItem = items[items.length - 1];
            lastItem.style.opacity = '0';
            setTimeout(function() { if (lastItem.parentNode) lastItem.parentNode.removeChild(lastItem); }, 300);
        }
    }
    function scheduleActivityUpdate() {
        setTimeout(function() { addNewActivity(); scheduleActivityUpdate(); }, (Math.floor(Math.random() * 12) + 8) * 1000);
    }
    initActivityFeed(); scheduleActivityUpdate();

    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var style = document.createElement('style');
    style.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.fade-in{animation:fadeInUp .6s ease forwards}';
    document.head.appendChild(style);
    document.querySelectorAll('.testimonial, .benefits, .urgency, .final-cta').forEach(function(s, i) {
        s.style.animationDelay = (i * 0.15) + 's'; s.classList.add('fade-in');
    });
})();
